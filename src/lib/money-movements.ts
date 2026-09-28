import type { MoneyMovement } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireStripe } from "@/lib/stripe";
import type { Tx } from "@/lib/order-status";

// Payouts to sellers and refunds to buyers.
//
// 1. queue*() is called inside the same database transaction that changes the
//    order (COMPLETED, refunded...). If that commits, the money movement is on
//    record; there is no window where the order says "paid out" and nothing
//    remembers that a payout is owed.
// 2. execute() then asks Stripe to do it, with a fixed idempotency key.
// 3. If Stripe fails (outage, network), the movement stays PENDING and the
//    hourly sweep retries it. Before a retry we first ask Stripe whether an
//    earlier attempt already went through (Stripe forgets idempotency keys
//    after 24 hours), so a lost response can never become a double payment.

const MAX_ATTEMPTS = 8;

export async function queuePayout(tx: Tx, t: { id: string; sellerPayoutAmount: number }, destination: string, key: string) {
  return tx.moneyMovement.upsert({
    where: { idempotencyKey: key },
    update: {},
    create: {
      transactionId: t.id,
      kind: "SELLER_PAYOUT",
      amountCents: Math.round(t.sellerPayoutAmount * 100),
      destination,
      idempotencyKey: key,
    },
  });
}

export async function queueRefund(tx: Tx, transactionId: string, paymentIntentId: string, key: string) {
  return tx.moneyMovement.upsert({
    where: { idempotencyKey: key },
    update: {},
    create: { transactionId, kind: "BUYER_REFUND", paymentIntentId, idempotencyKey: key },
  });
}

/** Look for an earlier attempt that Stripe completed but we never heard back about. */
async function findExisting(m: MoneyMovement): Promise<string | null> {
  const stripe = requireStripe();
  if (m.kind === "SELLER_PAYOUT") {
    const list = await stripe.transfers.list({ transfer_group: m.transactionId, limit: 100 });
    return list.data.find((t) => t.metadata?.movementId === m.id)?.id ?? null;
  }
  const list = await stripe.refunds.list({ payment_intent: m.paymentIntentId!, limit: 100 });
  return list.data.find((r) => r.metadata?.movementId === m.id)?.id ?? null;
}

/** Try to carry out one movement. Never throws for a Stripe error: it records it. */
export async function execute(movementId: string): Promise<MoneyMovement> {
  const m = await prisma.moneyMovement.findUniqueOrThrow({ where: { id: movementId } });
  if (m.status !== "PENDING") return m;

  try {
    const stripe = requireStripe();
    let objectId = m.attempts > 0 ? await findExisting(m) : null;
    if (!objectId) {
      const metadata = { transactionId: m.transactionId, movementId: m.id };
      const obj =
        m.kind === "SELLER_PAYOUT"
          ? await stripe.transfers.create(
              { amount: m.amountCents!, currency: m.currency, destination: m.destination!, transfer_group: m.transactionId, metadata },
              { idempotencyKey: m.idempotencyKey }
            )
          : await stripe.refunds.create(
              { payment_intent: m.paymentIntentId!, ...(m.amountCents ? { amount: m.amountCents } : {}), metadata },
              { idempotencyKey: m.idempotencyKey }
            );
      objectId = obj.id;
    }
    await prisma.moneyMovement.updateMany({
      where: { id: m.id, status: "PENDING" },
      data: { status: "SUCCEEDED", stripeObjectId: objectId, attempts: { increment: 1 }, lastError: null },
    });
  } catch (err) {
    const attempts = m.attempts + 1;
    await prisma.moneyMovement.updateMany({
      where: { id: m.id, status: "PENDING" },
      data: {
        attempts,
        lastError: String((err as Error)?.message ?? err).slice(0, 500),
        ...(attempts >= MAX_ATTEMPTS ? { status: "FAILED" } : {}),
      },
    });
    console.error(`money movement ${m.id} (${m.kind}) attempt ${attempts} failed:`, err);
  }
  return prisma.moneyMovement.findUniqueOrThrow({ where: { id: m.id } });
}

/** Hourly: retry movements still pending after a few minutes. */
export async function retryPending(now = new Date()) {
  const due = await prisma.moneyMovement.findMany({
    where: { status: "PENDING", updatedAt: { lte: new Date(now.getTime() - 5 * 60_000) } },
    orderBy: { createdAt: "asc" },
    take: 100,
  });
  let succeeded = 0;
  for (const m of due) {
    if ((await execute(m.id)).status === "SUCCEEDED") succeeded++;
  }
  return { retried: due.length, succeeded };
}
