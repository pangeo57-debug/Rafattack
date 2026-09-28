import type { OrderActor, OrderStatus, Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";

// The order lifecycle, in one place. No code changes an order's status except
// through transition() below, which checks this table and records the change.
export const TRANSITIONS: Record<OrderStatus, readonly OrderStatus[]> = {
  AWAITING_PAYMENT: ["PAID", "CANCELLED"],
  PAID: ["SHIPPED", "PICKED_UP", "DISPUTED", "CANCELLED"], // CANCELLED = refunded, seller didn't ship
  SHIPPED: ["COMPLETED", "DISPUTED"],
  PICKED_UP: ["COMPLETED", "DISPUTED"],
  DISPUTED: ["COMPLETED", "CANCELLED"], // admin decides
  COMPLETED: [],
  CANCELLED: [],
};

export type Tx = Prisma.TransactionClient;

export type Actor = { actor: OrderActor; userId?: string | null };

/**
 * Move order `id` to `to`, but only if its current status is in `from` and
 * the move is allowed by TRANSITIONS. Locks the order row first, so two
 * callers racing each other (a double click, the hourly timer, a webhook)
 * are serialised: exactly one sees the old status and wins; the rest get
 * null. Writes an OrderEvent in the same database transaction.
 *
 * Returns the status the order had before, or null if nothing changed.
 */
export async function transition(
  tx: Tx,
  input: {
    id: string;
    from: readonly OrderStatus[];
    to: OrderStatus;
    by: Actor;
    reason?: string | null;
    data?: Omit<Prisma.TransactionUpdateInput, "orderStatus">;
  }
): Promise<OrderStatus | null> {
  for (const f of input.from) {
    if (!TRANSITIONS[f].includes(input.to)) {
      throw new Error(`Order status ${f} → ${input.to} is not an allowed transition`);
    }
  }

  const rows = await tx.$queryRaw<{ orderStatus: OrderStatus }[]>`
    SELECT "orderStatus" FROM "Transaction" WHERE "id" = ${input.id} FOR UPDATE`;
  const current = rows[0]?.orderStatus;
  if (!current || !input.from.includes(current)) return null;

  await tx.transaction.update({ where: { id: input.id }, data: { ...input.data, orderStatus: input.to } });
  await tx.orderEvent.create({
    data: {
      transactionId: input.id,
      fromStatus: current,
      toStatus: input.to,
      actor: input.by.actor,
      actorUserId: input.by.userId ?? null,
      reason: input.reason ?? null,
    },
  });
  return current;
}

/** transition() in its own database transaction. */
export function transitionNow(input: Parameters<typeof transition>[1]) {
  return prisma.$transaction((tx) => transition(tx, input));
}

/** Record the first status of a new order (called where the order is created). */
export function recordCreated(tx: Tx, transactionId: string, by: Actor, reason: string) {
  return tx.orderEvent.create({
    data: { transactionId, fromStatus: null, toStatus: "AWAITING_PAYMENT", actor: by.actor, actorUserId: by.userId ?? null, reason },
  });
}
