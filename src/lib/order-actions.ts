import { prisma } from "@/lib/prisma";
import { notify } from "@/lib/notify";
import { returnUnitsToBuyOrder } from "@/lib/buy-orders";
import { transition, type Actor, type Tx } from "@/lib/order-status";
import { queuePayout, queueRefund, execute } from "@/lib/money-movements";

// The order changes that move money or stock, shared by the buttons
// (/api/transactions/[id]), the timers (lib/order-timers.ts) and the admin
// dispute decision, so all follow exactly the same rules. Status changes go
// through transition() (allowed moves, row lock, audit log); money goes
// through money-movements (recorded with the change, retried if Stripe fails).
//
// Lock order is always: order row → buy request → listing, the same as when
// an order is created from a buy request, so two of these can't deadlock.

const PAUSE_REASONS = {
  BUYER: "You cancelled an order that came from this request, so we paused it. Resume it when you're ready to buy.",
  PAYMENT_DEADLINE: "An order from this request wasn't paid in time, so we paused it. Resume it when you're ready to buy.",
} as const;

/**
 * AWAITING_PAYMENT → CANCELLED, and give the reserved units back, to the
 * buy request (if the order came from one) and the listing. `cause` says who
 * is responsible: a buyer who backs out has their request paused.
 */
export async function cancelUnpaidOrder(
  id: string,
  cause: "BUYER" | "SELLER" | "PAYMENT_DEADLINE",
  userId?: string | null
): Promise<boolean> {
  const by: Actor = { actor: cause === "PAYMENT_DEADLINE" ? "SYSTEM" : cause, userId };
  const result = await prisma.$transaction(async (tx) => {
    const was = await transition(tx, {
      id,
      from: ["AWAITING_PAYMENT"],
      to: "CANCELLED",
      by,
      reason:
        cause === "PAYMENT_DEADLINE" ? "Not paid within the payment deadline" : `Cancelled by the ${cause.toLowerCase()} before payment`,
      data: { cancelledAt: new Date() },
    });
    if (!was) return null;
    const bid = await returnUnitsToBuyOrder(tx, id, cause === "SELLER" ? null : PAUSE_REASONS[cause]);
    await restoreStock(tx, id);
    return { bid };
  });
  if (!result) return false;
  if (result.bid && cause !== "SELLER") {
    await notify(result.bid.buyerBusinessId, "OFFER_UPDATED", "Buy request paused", PAUSE_REASONS[cause], "/dashboard/bids");
  }
  return true;
}

/** SHIPPED/PICKED_UP → COMPLETED, and pay the seller exactly once. */
export async function completeOrder(id: string, by: Actor, reason: string): Promise<boolean> {
  const payout = await prisma.$transaction(async (tx) => {
    const was = await transition(tx, {
      id,
      from: ["SHIPPED", "PICKED_UP"],
      to: "COMPLETED",
      by,
      reason,
      data: { paymentStatus: "CAPTURED", escrowStatus: "RELEASED", completedAt: new Date() },
    });
    if (!was) return false;
    return queueSellerPayout(tx, id, `transfer-complete-${id}`);
  });
  if (payout === false) return false;
  if (payout) await execute(payout.id);
  return true;
}

/** PAID but never shipped → CANCELLED, full refund to the buyer, stock back. */
export async function refundUnshippedOrder(id: string): Promise<boolean> {
  const refund = await prisma.$transaction(async (tx) => {
    const was = await transition(tx, {
      id,
      from: ["PAID"],
      to: "CANCELLED",
      by: { actor: "SYSTEM" },
      reason: "Seller didn't ship within the shipping deadline; buyer refunded in full",
      data: { paymentStatus: "REFUNDED", escrowStatus: "REFUNDED", cancelledAt: new Date() },
    });
    if (!was) return false;
    // The seller let the buyer down, not the other way round: the buyer's
    // request gets its units back and keeps running.
    await returnUnitsToBuyOrder(tx, id, null);
    await restoreStock(tx, id);
    return queueBuyerRefund(tx, id, `refund-unshipped-${id}`);
  });
  if (refund === false) return false;
  if (refund) await execute(refund.id);
  return true;
}

/** Admin decision on a disputed order: pay the seller, or refund the buyer. */
export async function resolveDispute(id: string, winner: "SELLER" | "BUYER", note: string, adminUserId: string): Promise<boolean> {
  const movement = await prisma.$transaction(async (tx) => {
    const by: Actor = { actor: "ADMIN", userId: adminUserId };
    if (winner === "SELLER") {
      const was = await transition(tx, {
        id,
        from: ["DISPUTED"],
        to: "COMPLETED",
        by,
        reason: `Dispute resolved for the seller: ${note}`,
        data: {
          paymentStatus: "CAPTURED",
          escrowStatus: "RELEASED",
          disputeStatus: "RESOLVED_SELLER",
          disputeNote: note,
          completedAt: new Date(),
        },
      });
      if (!was) return false;
      return queueSellerPayout(tx, id, `transfer-dispute-${id}`);
    }
    const was = await transition(tx, {
      id,
      from: ["DISPUTED"],
      to: "CANCELLED",
      by,
      reason: `Dispute resolved for the buyer: ${note}`,
      data: {
        paymentStatus: "REFUNDED",
        escrowStatus: "REFUNDED",
        disputeStatus: "RESOLVED_BUYER",
        disputeNote: note,
        cancelledAt: new Date(),
      },
    });
    if (!was) return false;
    return queueBuyerRefund(tx, id, `refund-dispute-${id}`);
  });
  if (movement === false) return false;
  if (movement) await execute(movement.id);
  return true;
}

async function queueSellerPayout(tx: Tx, id: string, key: string) {
  const t = await tx.transaction.findUniqueOrThrow({ where: { id }, include: { sellerBusiness: true } });
  if (!t.sellerBusiness.stripeAccountId) return null;
  return queuePayout(tx, t, t.sellerBusiness.stripeAccountId, key);
}

async function queueBuyerRefund(tx: Tx, id: string, key: string) {
  const t = await tx.transaction.findUniqueOrThrow({ where: { id } });
  if (!t.stripePaymentIntentId) return null;
  return queueRefund(tx, id, t.stripePaymentIntentId, key);
}

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
