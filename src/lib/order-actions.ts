import { prisma } from "@/lib/prisma";
import { requireStripe } from "@/lib/stripe";
import { notify } from "@/lib/notify";
import { returnUnitsToBuyOrder } from "@/lib/buy-orders";

// The order transitions that move money or stock, shared by the buttons
// (/api/transactions/[id]) and the timers (lib/order-timers.ts) so both
// follow exactly the same rules. Each one claims the order atomically, so a
// double click, a retry, or the timer racing a button does it only once.

const PAUSE_REASONS = {
  BUYER: "You cancelled an order that came from this request, so we paused it. Resume it when you're ready to buy.",
  PAYMENT_DEADLINE: "An order from this request wasn't paid in time, so we paused it. Resume it when you're ready to buy.",
} as const;

/**
 * AWAITING_PAYMENT → CANCELLED, and give the reserved units back, to the
 * listing and (if the order came from one) to the buy request. `cause` says
 * who is responsible: a buyer who backs out has their request paused.
 */
export async function cancelUnpaidOrder(id: string, cause: "BUYER" | "SELLER" | "PAYMENT_DEADLINE"): Promise<boolean> {
  const bid = await prisma.$transaction(async (tx) => {
    const claim = await tx.transaction.updateMany({
      where: { id, orderStatus: "AWAITING_PAYMENT" },
      data: { orderStatus: "CANCELLED", cancelledAt: new Date() },
    });
    if (claim.count === 0) return false;
    await restoreStock(tx, id);
    return (await returnUnitsToBuyOrder(tx, id, cause === "SELLER" ? null : PAUSE_REASONS[cause])) ?? true;
  });
  if (bid === false) return false;
  if (bid !== true && cause !== "SELLER") {
    await notify(bid.buyerBusinessId, "OFFER_UPDATED", "Buy request paused", PAUSE_REASONS[cause], "/dashboard/bids");
  }
  return true;
}

/** SHIPPED/PICKED_UP → COMPLETED, then pay the seller once. */
export async function completeOrder(id: string): Promise<boolean> {
  const claimed = await prisma.transaction.updateMany({
    where: { id, orderStatus: { in: ["SHIPPED", "PICKED_UP"] } },
    data: {
      orderStatus: "COMPLETED",
      paymentStatus: "CAPTURED",
      escrowStatus: "RELEASED",
      completedAt: new Date(),
    },
  });
  if (claimed.count === 0) return false;

  const transaction = await prisma.transaction.findUniqueOrThrow({
    where: { id },
    include: { sellerBusiness: true },
  });
  if (transaction.sellerBusiness.stripeAccountId) {
    await requireStripe().transfers.create(
      {
        amount: Math.round(transaction.sellerPayoutAmount * 100),
        currency: "eur",
        destination: transaction.sellerBusiness.stripeAccountId,
        transfer_group: transaction.id,
        metadata: { transactionId: transaction.id },
      },
      { idempotencyKey: `transfer-complete-${transaction.id}` }
    );
  }
  return true;
}

/** PAID but never shipped → CANCELLED, full refund to the buyer, stock back. */
export async function refundUnshippedOrder(id: string): Promise<boolean> {
  const claimed = await prisma.$transaction(async (tx) => {
    const claim = await tx.transaction.updateMany({
      where: { id, orderStatus: "PAID" },
      data: {
        orderStatus: "CANCELLED",
        paymentStatus: "REFUNDED",
        escrowStatus: "REFUNDED",
        cancelledAt: new Date(),
      },
    });
    if (claim.count === 0) return false;
    await restoreStock(tx, id);
    // The seller let the buyer down, not the other way round: the buyer's
    // request gets its units back and keeps running.
    await returnUnitsToBuyOrder(tx, id, null);
    return true;
  });
  if (!claimed) return false;

  const transaction = await prisma.transaction.findUniqueOrThrow({ where: { id } });
  if (transaction.stripePaymentIntentId) {
    await requireStripe().refunds.create(
      { payment_intent: transaction.stripePaymentIntentId },
      { idempotencyKey: `refund-unshipped-${transaction.id}` }
    );
  }
  return true;
}

type Tx = Parameters<Parameters<typeof prisma.$transaction>[0]>[0];

async function restoreStock(tx: Tx, transactionId: string) {
  const { listingId, quantity } = await tx.transaction.findUniqueOrThrow({ where: { id: transactionId } });
  const listing = await tx.listing.update({
    where: { id: listingId },
    data: { quantityAvailable: { increment: quantity } },
  });
  if (listing.status === "SOLD_OUT" && listing.quantityAvailable > 0) {
    await tx.listing.update({ where: { id: listing.id }, data: { status: "ACTIVE" } });
  }
}
