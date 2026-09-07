import { prisma } from "@/lib/prisma";
import { DEFAULT_COMMISSION_PERCENT } from "@/lib/constants";

export async function getCommissionPercent(): Promise<number> {
  const setting = await prisma.platformSetting.findUnique({
    where: { id: "singleton" },
  });
  return setting?.commissionPercent ?? DEFAULT_COMMISSION_PERCENT;
}

export function computeAmounts(unitPrice: number, quantity: number, commissionPercent: number) {
  const amount = round2(unitPrice * quantity);
  const commissionAmount = round2((amount * commissionPercent) / 100);
  const sellerPayoutAmount = round2(amount - commissionAmount);
  return { amount, commissionAmount, sellerPayoutAmount };
}

function round2(n: number) {
  return Math.round(n * 100) / 100;
}
