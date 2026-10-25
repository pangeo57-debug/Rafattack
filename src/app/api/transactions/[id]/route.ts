import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { findTransactionAsParty, notFoundResponse } from "@/lib/access";
import { requireStripe } from "@/lib/stripe";
import { notify } from "@/lib/notify";
import { cancelUnpaidOrder, completeOrder } from "@/lib/order-actions";
import { transitionNow } from "@/lib/order-status";

const bodySchema = z.object({
  action: z.enum(["CANCEL", "SHIP", "MARK_PICKED_UP", "COMPLETE", "DISPUTE"]),
  reason: z.string().optional(),
  carrier: z.string().trim().max(60).optional(),
  trackingNumber: z.string().trim().max(80).optional(),
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
  const { action, reason, carrier, trackingNumber } = parsed.data;

  if (action === "CANCEL") {
    const cancelled = await cancelUnpaidOrder(id, isBuyer ? "BUYER" : "SELLER", session.user.id);
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
    // Shipping needs proof of dispatch: who carries it (and the tracking
    // number if there is one). It is what settles "it never arrived".
    if (action === "SHIP" && (!carrier || carrier.length < 2)) {
      return NextResponse.json({ error: "Enter the carrier (e.g. ACS, ELTA Courier, own delivery)." }, { status: 400 });
    }
    // Through the state machine (row lock): the ship deadline timer may
    // refund this order at the same moment.
    const shipped = await transitionNow({
      id,
      from: ["PAID"],
      to: action === "SHIP" ? "SHIPPED" : "PICKED_UP",
      by: { actor: "SELLER", userId: session.user.id },
      reason: action === "SHIP" ? `Shipped with ${carrier}${trackingNumber ? `, tracking ${trackingNumber}` : ""}` : "Buyer picked up the goods",
      data: {
        shippedAt: new Date(),
        ...(action === "SHIP" ? { carrier, trackingNumber: trackingNumber || null } : {}),
      },
    });
    if (!shipped) {
      return NextResponse.json({ error: "Order must be paid first." }, { status: 400 });
    }
    const updated = await prisma.transaction.findUniqueOrThrow({ where: { id } });
    await notify(
      transaction.buyerBusinessId,
      "ORDER_STATUS_CHANGED",
      action === "SHIP" ? "Order shipped" : "Order ready for pickup",
      action === "SHIP"
        ? `Your order for "${transaction.listing.title}" was shipped with ${carrier}${trackingNumber ? ` (tracking ${trackingNumber})` : ""}. Confirm receipt once you have it.`
        : `Your order for "${transaction.listing.title}" is on its way. Confirm receipt once you have it.`,
      `/dashboard/orders/${id}`
    );
    return NextResponse.json(updated);
  }

  if (action === "COMPLETE") {
    if (!isBuyer) return NextResponse.json({ error: "Only the buyer can confirm receipt." }, { status: 403 });
    if (!["SHIPPED", "PICKED_UP"].includes(transaction.orderStatus)) {
      return NextResponse.json({ error: "Order isn't ready to be completed yet." }, { status: 400 });
    }

    // Row lock inside completeOrder(): a double click or retry pays the
    // seller exactly once.
    if (!(await completeOrder(id, { actor: "BUYER", userId: session.user.id }, "Buyer confirmed receipt"))) {
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
    // Row lock: the confirm deadline timer may be releasing the payout at
    // the same moment, and a dispute must not land after that.
    const disputed = await transitionNow({
      id,
      from: ["PAID", "SHIPPED", "PICKED_UP"],
      to: "DISPUTED",
      by: { actor: isBuyer ? "BUYER" : "SELLER", userId: session.user.id },
      reason: reason ?? "No reason provided",
      data: { disputeStatus: "OPEN", disputeReason: reason ?? "No reason provided" },
    });
    if (!disputed) {
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
