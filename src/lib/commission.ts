import { prisma } from "@/lib/prisma";
import { DEFAULT_COMMISSION_BPS } from "@/lib/constants";

// The single pricing function. The price the buyer sees, the amount charged
// by Stripe, the seller's payout and the commission invoice all come from
// computeAmounts(). Integer cents and basis points only: no floats.

export async function getCommissionBps(): Promise<number> {
  const setting = await prisma.platformSetting.findUnique({ where: { id: "singleton" } });
  return setting?.commissionBps ?? DEFAULT_COMMISSION_BPS;
}

export function computeAmounts(unitPriceCents: number, quantity: number, commissionBps: number) {
  for (const [name, v] of [["unitPriceCents", unitPriceCents], ["quantity", quantity], ["commissionBps", commissionBps]] as const) {
    if (!Number.isSafeInteger(v) || v < 0) throw new Error(`${name} must be a non-negative integer, got ${v}`);
  }
  const amountCents = unitPriceCents * quantity;
  if (!Number.isSafeInteger(amountCents)) throw new Error("Order amount too large");
  // Commission rounded half up to the cent, in integers: floor((a*b + 5000) / 10000).
  const commissionCents = Math.floor((amountCents * commissionBps + 5000) / 10000);
  const sellerPayoutCents = amountCents - commissionCents;
  return { amountCents, commissionCents, sellerPayoutCents };
}
