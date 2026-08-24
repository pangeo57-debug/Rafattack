import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { requireStripe } from "@/lib/stripe";
import { notify } from "@/lib/notify";

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

  const transaction = await prisma.transaction.findUnique({
    where: { id },
    include: { listing: true, sellerBusiness: true },
  });
  if (!transaction) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const isSeller = transaction.sellerBusinessId === businessId;
  const isBuyer = transaction.buyerBusinessId === businessId;
  if (!isSeller && !isBuyer) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const parsed = bodySchema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });
  }
  const { action, reason } = parsed.data;

  if (action === "CANCEL") {
    if (transaction.orderStatus !== "AWAITING_PAYMENT") {
      return NextResponse.json({ error: "Only unpaid orders can be cancelled." }, { status: 400 });
    }
    const updated = await prisma.transaction.update({
      where: { id },
      data: { orderStatus: "CANCELLED", cancelledAt: new Date() },
    });
    return NextResponse.json(updated);
  }

  if (action === "SHIP" || action === "MARK_PICKED_UP") {
    if (!isSeller) return NextResponse.json({ error: "Only the seller can update fulfillment." }, { status: 403 });
    if (transaction.orderStatus !== "PAID") {
      return NextResponse.json({ error: "Order must be paid first." }, { status: 400 });
    }
    const updated = await prisma.transaction.update({
      where: { id },
      data: {
        orderStatus: action === "SHIP" ? "SHIPPED" : "PICKED_UP",
        shippedAt: new Date(),
      },
    });
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

    if (transaction.sellerBusiness.stripeAccountId) {
      const stripe = requireStripe();
      await stripe.transfers.create({
        amount: Math.round(transaction.sellerPayoutAmount * 100),
        currency: "eur",
        destination: transaction.sellerBusiness.stripeAccountId,
        transfer_group: transaction.id,
        metadata: { transactionId: transaction.id },
      });
    }

    const updated = await prisma.transaction.update({
      where: { id },
      data: {
        orderStatus: "COMPLETED",
        paymentStatus: "CAPTURED",
        escrowStatus: "RELEASED",
        completedAt: new Date(),
      },
    });
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
    if (!["PAID", "SHIPPED", "PICKED_UP"].includes(transaction.orderStatus)) {
      return NextResponse.json({ error: "This order can't be disputed right now." }, { status: 400 });
    }
    const updated = await prisma.transaction.update({
      where: { id },
      data: {
        orderStatus: "DISPUTED",
        disputeStatus: "OPEN",
        disputeReason: reason ?? "No reason provided",
      },
    });
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
