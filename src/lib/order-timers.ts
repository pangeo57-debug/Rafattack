import type { Transaction } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireStripe } from "@/lib/stripe";
import { notify } from "@/lib/notify";
import { cancelUnpaidOrder, completeOrder, refundUnshippedOrder } from "@/lib/order-actions";
import { expireBuyOrders } from "@/lib/buy-orders";
import { retryPending } from "@/lib/money-movements";

// Every order deadline lives here. The order page shows these same dates, so
// what the user is told and what the timer does can't drift apart.
export const PAY_WITHIN_HOURS = 48;
export const SHIP_WITHIN_DAYS = 7;
export const CONFIRM_WITHIN_DAYS = 7;

const HOUR = 60 * 60 * 1000;
const DAY = 24 * HOUR;

type Deadline = { kind: "PAY" | "SHIP" | "CONFIRM"; at: Date };

/** The next automatic step for this order, if any. */
export function deadlineFor(
  t: Pick<Transaction, "orderStatus" | "createdAt" | "paidAt" | "shippedAt">
): Deadline | null {
  if (t.orderStatus === "AWAITING_PAYMENT") {
    return { kind: "PAY", at: new Date(t.createdAt.getTime() + PAY_WITHIN_HOURS * HOUR) };
  }
  if (t.orderStatus === "PAID" && t.paidAt) {
    return { kind: "SHIP", at: new Date(t.paidAt.getTime() + SHIP_WITHIN_DAYS * DAY) };
  }
  if ((t.orderStatus === "SHIPPED" || t.orderStatus === "PICKED_UP") && t.shippedAt) {
    return { kind: "CONFIRM", at: new Date(t.shippedAt.getTime() + CONFIRM_WITHIN_DAYS * DAY) };
  }
  return null;
}

/**
 * Apply every deadline that has passed. Safe to run as often as you like and
 * concurrently: each step claims the order atomically, and a disputed order
 * is never touched (DISPUTED has no deadline — an admin decides).
 */
export async function runOrderTimers(now = new Date()) {
  const result = { expired: 0, refunded: 0, completed: 0, skipped: 0, buyRequestsExpired: 0, paymentsRetried: 0 };

  const unpaid = await prisma.transaction.findMany({
    where: { orderStatus: "AWAITING_PAYMENT", createdAt: { lte: new Date(now.getTime() - PAY_WITHIN_HOURS * HOUR) } },
    include: { listing: { select: { title: true } } },
  });
  for (const t of unpaid) {
    if (!(await closeCheckout(t))) {
      result.skipped++;
      continue;
    }
    if (!(await cancelUnpaidOrder(t.id, "PAYMENT_DEADLINE"))) continue;
    result.expired++;
    const msg = `Order for "${t.listing.title}" was not paid within ${PAY_WITHIN_HOURS} hours, so it was cancelled and the stock released.`;
    await notify(t.buyerBusinessId, "ORDER_STATUS_CHANGED", "Order cancelled: not paid in time", msg, `/dashboard/orders/${t.id}`);
    await notify(t.sellerBusinessId, "ORDER_STATUS_CHANGED", "Unpaid order cancelled", msg, `/dashboard/orders/${t.id}`);
  }

  const unshipped = await prisma.transaction.findMany({
    where: { orderStatus: "PAID", paidAt: { lte: new Date(now.getTime() - SHIP_WITHIN_DAYS * DAY) } },
    include: { listing: { select: { title: true } } },
  });
  for (const t of unshipped) {
    if (!(await refundUnshippedOrder(t.id))) continue;
    result.refunded++;
    await notify(
      t.buyerBusinessId,
      "ORDER_STATUS_CHANGED",
      "Order refunded: seller didn't ship",
      `The seller didn't ship "${t.listing.title}" within ${SHIP_WITHIN_DAYS} days, so the order was cancelled and your payment refunded in full.`,
      `/dashboard/orders/${t.id}`
    );
    await notify(
      t.sellerBusinessId,
      "ORDER_STATUS_CHANGED",
      "Order cancelled: not shipped in time",
      `"${t.listing.title}" wasn't marked as shipped within ${SHIP_WITHIN_DAYS} days of payment, so the buyer was refunded and the units returned to your listing.`,
      `/dashboard/orders/${t.id}`
    );
  }

  const unconfirmed = await prisma.transaction.findMany({
    where: {
      orderStatus: { in: ["SHIPPED", "PICKED_UP"] },
      shippedAt: { lte: new Date(now.getTime() - CONFIRM_WITHIN_DAYS * DAY) },
    },
    include: { listing: { select: { title: true } } },
  });
  for (const t of unconfirmed) {
    if (!(await completeOrder(t.id, { actor: "SYSTEM" }, `No problem reported within ${CONFIRM_WITHIN_DAYS} days of dispatch`))) continue;
    result.completed++;
    await notify(
      t.sellerBusinessId,
      "ORDER_STATUS_CHANGED",
      "Order completed automatically",
      `The buyer didn't report a problem with "${t.listing.title}" within ${CONFIRM_WITHIN_DAYS} days, so your payout has been released.`,
      `/dashboard/orders/${t.id}`
    );
    await notify(
      t.buyerBusinessId,
      "ORDER_STATUS_CHANGED",
      "Order completed automatically",
      `No problem was reported with "${t.listing.title}" within ${CONFIRM_WITHIN_DAYS} days of dispatch, so payment was released to the seller.`,
      `/dashboard/orders/${t.id}`
    );
  }

  result.buyRequestsExpired = await expireBuyOrders(now);
  // Payouts and refunds Stripe didn't confirm last time.
  result.paymentsRetried = (await retryPending(now)).retried;
  return result;
}

/**
 * Make sure the order can no longer be paid before we cancel it. Returns
 * false when a payment is already under way (e.g. a SEPA transfer that takes
 * days to clear): that order is left alone until the payment lands or fails.
 */
async function closeCheckout(t: Transaction): Promise<boolean> {
  if (!t.stripeCheckoutSessionId) return true;
  const stripe = requireStripe();
  const session = await stripe.checkout.sessions.retrieve(t.stripeCheckoutSessionId);
  if (session.status === "complete") return t.paymentStatus === "FAILED";
  if (session.status === "open") {
    try {
      await stripe.checkout.sessions.expire(session.id);
    } catch {
      // Paid in the moment between retrieve and expire.
      return false;
    }
  }
  return true;
}
