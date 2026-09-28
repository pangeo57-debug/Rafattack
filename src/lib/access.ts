import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// The one place that decides whether a business may touch a given object.
// Every route and page that loads an object by id goes through these, and
// "doesn't exist" and "isn't yours" return the same null, so callers can't
// accidentally reveal which ids exist to someone probing them.

export function notFoundResponse() {
  return NextResponse.json({ error: "Not found" }, { status: 404 });
}

/** A listing the business sells. */
export async function findOwnListing(id: string, businessId: string) {
  const listing = await prisma.listing.findUnique({ where: { id } });
  return listing && listing.sellerBusinessId === businessId ? listing : null;
}

/** An offer where the business is the buyer or the listing's seller. */
export async function findOfferAsParty(id: string, businessId: string) {
  const offer = await prisma.offer.findUnique({ where: { id }, include: { listing: true } });
  if (!offer) return null;
  const isSeller = offer.listing.sellerBusinessId === businessId;
  const isBuyer = offer.buyerBusinessId === businessId;
  return isSeller || isBuyer ? { offer, isSeller, isBuyer } : null;
}

/** An order where the business is the buyer or the seller. */
export async function findTransactionAsParty(id: string, businessId: string) {
  const transaction = await prisma.transaction.findUnique({
    where: { id },
    include: { listing: true, sellerBusiness: true },
  });
  if (!transaction) return null;
  const isSeller = transaction.sellerBusinessId === businessId;
  const isBuyer = transaction.buyerBusinessId === businessId;
  return isSeller || isBuyer ? { transaction, isSeller, isBuyer } : null;
}
