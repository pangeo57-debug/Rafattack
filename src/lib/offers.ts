import { prisma } from "@/lib/prisma";
import { getCommissionPercent, computeAmounts } from "@/lib/commission";
import { notify } from "@/lib/notify";
import type { Offer, Listing } from "@prisma/client";

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

    const remaining = listing.quantityAvailable - finalQuantity;
    await tx.listing.update({
      where: { id: listing.id },
      data: {
        quantityAvailable: Math.max(remaining, 0),
        status: remaining <= 0 ? "SOLD_OUT" : listing.status,
      },
    });

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
