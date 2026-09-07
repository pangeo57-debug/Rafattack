import { prisma } from "@/lib/prisma";
import { getCommissionPercent, computeAmounts } from "@/lib/commission";
import { notify } from "@/lib/notify";
import type { Offer, Listing } from "@prisma/client";

export class InsufficientStockError extends Error {
  constructor() {
    super("Not enough stock left on this listing to accept this offer.");
    this.name = "InsufficientStockError";
  }
}

export async function acceptOfferAndCreateTransaction(
  offer: Offer,
  listing: Listing,
  finalPrice: number,
  finalQuantity: number
) {
  const commissionPercent = await getCommissionPercent();
  const { amount, commissionAmount, sellerPayoutAmount } = computeAmounts(
    finalPrice,
    finalQuantity,
    commissionPercent
  );

  const transaction = await prisma.$transaction(async (tx) => {
    await tx.offer.update({
      where: { id: offer.id },
      data: {
        status: "ACCEPTED",
        offeredPrice: finalPrice,
        quantity: finalQuantity,
      },
    });

    // Decrement atomically and conditionally, guarded in the same statement
    // by the current stock level — not by the `listing` snapshot passed into
    // this function, which may already be stale by the time this runs.
    // Two concurrent accepts on the same listing each take a row lock here,
    // so the second one sees the first's decrement instead of overwriting it
    // (a plain read-then-write on `listing.quantityAvailable` let two
    // accepts each independently subtract from the same stale number,
    // silently overselling the listing).
    const decremented = await tx.listing.updateMany({
      where: { id: listing.id, quantityAvailable: { gte: finalQuantity } },
      data: { quantityAvailable: { decrement: finalQuantity } },
    });
    if (decremented.count === 0) {
      throw new InsufficientStockError();
    }

    const fresh = await tx.listing.findUniqueOrThrow({ where: { id: listing.id } });
    if (fresh.quantityAvailable <= 0 && fresh.status === "ACTIVE") {
      await tx.listing.update({ where: { id: listing.id }, data: { status: "SOLD_OUT" } });
    }

    return tx.transaction.create({
      data: {
        offerId: offer.id,
        listingId: listing.id,
        sellerBusinessId: listing.sellerBusinessId,
        buyerBusinessId: offer.buyerBusinessId,
        quantity: finalQuantity,
        unitPrice: finalPrice,
        amount,
        commissionRate: commissionPercent,
        commissionAmount,
        sellerPayoutAmount,
      },
    });
  });

  await notify(
    listing.sellerBusinessId,
    "OFFER_UPDATED",
    "Offer accepted",
    `An offer on "${listing.title}" was accepted. Awaiting buyer payment.`,
    `/dashboard/orders/${transaction.id}`
  );
  await notify(
    offer.buyerBusinessId,
    "OFFER_UPDATED",
    "Your offer was accepted",
    `Pay now to complete your order for "${listing.title}".`,
    `/dashboard/orders/${transaction.id}`
  );

  return transaction;
}
