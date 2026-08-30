import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { requireStripe } from "@/lib/stripe";
import { notify } from "@/lib/notify";

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const session = await auth();
  if (session?.user?.platformRole !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const { resolution, note } = await req.json();
  if (!["SELLER", "BUYER"].includes(resolution)) {
    return NextResponse.json({ error: "resolution must be SELLER or BUYER" }, { status: 400 });
  }

  const transaction = await prisma.transaction.findUnique({
    where: { id },
    include: { sellerBusiness: true },
  });
  if (!transaction) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (transaction.orderStatus !== "DISPUTED") {
    return NextResponse.json({ error: "This order is not under dispute." }, { status: 400 });
  }

  const stripe = requireStripe();

  // Atomically claim the resolution before moving any money — the same
  // double-click / retry race that could double-pay a seller on COMPLETE
  // applies here too (an admin could double-click "Resolve", or hit it from
  // two tabs). Only the first caller's conditional update succeeds; the
  // second sees count === 0 and stops before calling Stripe.
  const claimed = await prisma.transaction.updateMany({
    where: { id, orderStatus: "DISPUTED" },
    data:
      resolution === "SELLER"
        ? {
            orderStatus: "COMPLETED",
            paymentStatus: "CAPTURED",
            escrowStatus: "RELEASED",
            disputeStatus: "RESOLVED_SELLER",
            disputeNote: note,
            completedAt: new Date(),
          }
        : {
            orderStatus: "CANCELLED",
            paymentStatus: "REFUNDED",
            escrowStatus: "REFUNDED",
            disputeStatus: "RESOLVED_BUYER",
            disputeNote: note,
            cancelledAt: new Date(),
          },
  });
  if (claimed.count === 0) {
    return NextResponse.json({ error: "This order is not under dispute." }, { status: 400 });
  }

  if (resolution === "SELLER") {
    if (transaction.sellerBusiness.stripeAccountId) {
      await stripe.transfers.create(
        {
          amount: Math.round(transaction.sellerPayoutAmount * 100),
          currency: "eur",
          destination: transaction.sellerBusiness.stripeAccountId,
          transfer_group: transaction.id,
          metadata: { transactionId: transaction.id },
        },
        { idempotencyKey: `transfer-dispute-${transaction.id}` }
      );
    }
    const updated = await prisma.transaction.findUniqueOrThrow({ where: { id } });
    await notify(transaction.sellerBusinessId, "DISPUTE_UPDATED", "Dispute resolved in your favor", "The order has been marked completed and your payout released.", `/dashboard/orders/${id}`);
    await notify(transaction.buyerBusinessId, "DISPUTE_UPDATED", "Dispute resolved", "The dispute was resolved in the seller's favor.", `/dashboard/orders/${id}`);
    return NextResponse.json(updated);
  }

  if (transaction.stripePaymentIntentId) {
    await stripe.refunds.create(
      { payment_intent: transaction.stripePaymentIntentId },
      { idempotencyKey: `refund-dispute-${transaction.id}` }
    );
  }
  const updated = await prisma.transaction.findUniqueOrThrow({ where: { id } });
  await notify(transaction.buyerBusinessId, "DISPUTE_UPDATED", "Dispute resolved in your favor", "Your payment has been released back to you.", `/dashboard/orders/${id}`);
  await notify(transaction.sellerBusinessId, "DISPUTE_UPDATED", "Dispute resolved", "The dispute was resolved in the buyer's favor.", `/dashboard/orders/${id}`);
  return NextResponse.json(updated);
}
