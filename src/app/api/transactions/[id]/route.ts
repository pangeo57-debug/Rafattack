import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { findTransactionAsParty, notFoundResponse } from "@/lib/access";
import { requireStripe } from "@/lib/stripe";
import { notify } from "@/lib/notify";
import { cancelUnpaidOrder, completeOrder } from "@/lib/order-actions";

const bodySchema = z.object({
  action: z.enum(["CANCEL", "SHIP", "MARK_PICKED_UP", "COMPLETE", "DISPUTE"]),
  reason: z.string().optional(),
});

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const session = await auth();
  if (!session?.user?.businessId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const businessId = session.user.businessId;

  const access = await findTransactionAsParty(id, businessId);
  if (!access) return notFoundResponse();
  const { transaction, isSeller, isBuyer } = access;

  const parsed = bodySchema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });
  }
  const { action, reason } = parsed.data;

  if (action === "CANCEL") {
    const cancelled = await cancelUnpaidOrder(id);
    if (!cancelled) {
      return NextResponse.json({ error: "Only unpaid orders can be cancelled." }, { status: 400 });
    }

    // Close the Stripe payment page so it can't be paid after cancelling. If a
    // payment still slips through, the webhook refunds it automatically.
    if (transaction.stripeCheckoutSessionId) {
      await requireStripe().checkout.sessions.expire(transaction.stripeCheckoutSessionId).catch(() => {});
    }

    const updated = await prisma.transaction.findUniqueOrThrow({ where: { id } });
    return NextResponse.json(updated);
  }

  if (action === "SHIP" || action === "MARK_PICKED_UP") {
    if (!isSeller) return NextResponse.json({ error: "Only the seller can update fulfillment." }, { status: 403 });
    // Conditional update, not read-then-write: the ship deadline timer may
    // refund this order at the same moment.
    const shipped = await prisma.transaction.updateMany({
      where: { id, orderStatus: "PAID" },
      data: {
        orderStatus: action === "SHIP" ? "SHIPPED" : "PICKED_UP",
        shippedAt: new Date(),
      },
    });
    if (shipped.count === 0) {
      return NextResponse.json({ error: "Order must be paid first." }, { status: 400 });
    }
    const updated = await prisma.transaction.findUniqueOrThrow({ where: { id } });
    await notify(
      transaction.buyerBusinessId,
      "ORDER_STATUS_CHANGED",
      action === "SHIP" ? "Order shipped" : "Order ready for pickup",
      `Your order for "${transaction.listing.title}" is on its way. Confirm receipt once you have it.`,
      `/dashboard/orders/${id}`
    );
    return NextResponse.json(updated);
  }

  if (action === "COMPLETE") {
    if (!isBuyer) return NextResponse.json({ error: "Only the buyer can confirm receipt." }, { status: 403 });
    if (!["SHIPPED", "PICKED_UP"].includes(transaction.orderStatus)) {
      return NextResponse.json({ error: "Order isn't ready to be completed yet." }, { status: 400 });
    }

    // Atomic claim inside completeOrder(): a double click or retry pays the
    // seller exactly once.
    if (!(await completeOrder(id))) {
      return NextResponse.json({ error: "Order isn't ready to be completed yet." }, { status: 400 });
    }

    const updated = await prisma.transaction.findUniqueOrThrow({ where: { id } });
    await notify(
      transaction.sellerBusinessId,
      "ORDER_STATUS_CHANGED",
      "Order completed",
      `The buyer confirmed receipt of "${transaction.listing.title}". Your payout has been released.`,
      `/dashboard/orders/${id}`
    );
    return NextResponse.json(updated);
  }

  if (action === "DISPUTE") {
    // Conditional update: the confirm deadline timer may be releasing the
    // payout at the same moment, and a dispute must not land after that.
    const disputed = await prisma.transaction.updateMany({
      where: { id, orderStatus: { in: ["PAID", "SHIPPED", "PICKED_UP"] } },
      data: {
        orderStatus: "DISPUTED",
        disputeStatus: "OPEN",
        disputeReason: reason ?? "No reason provided",
      },
    });
    if (disputed.count === 0) {
      return NextResponse.json({ error: "This order can't be disputed right now." }, { status: 400 });
    }
    const updated = await prisma.transaction.findUniqueOrThrow({ where: { id } });
    const otherParty = isBuyer ? transaction.sellerBusinessId : transaction.buyerBusinessId;
    await notify(
      otherParty,
      "DISPUTE_UPDATED",
      "Order disputed",
      `A dispute was opened on "${transaction.listing.title}". Our team will review it.`,
      `/dashboard/orders/${id}`
    );
    return NextResponse.json(updated);
  }

  return NextResponse.json({ error: "Invalid action" }, { status: 400 });
}
