import type { Business, Transaction } from "@prisma/client";

export type BillingDetails = {
  name: string;
  taxId: string;
  address: string | null;
  city: string;
  country: string;
  contactEmail: string;
};

/**
 * The seller issues the invoice for the goods, so the seller of a paid order
 * gets the buyer's billing details. Nobody else does: not the buyer (they
 * already know their own), and not the seller of an order that was never
 * paid (no sale happened, so there is nothing to invoice).
 *
 * Callers must have passed findTransactionAsParty() first; this only decides
 * what a party of the order may see.
 */
export function buyerBillingForSeller(
  transaction: Pick<Transaction, "paidAt"> & { buyerBusiness: Business },
  isSeller: boolean
): BillingDetails | null {
  if (!isSeller || !transaction.paidAt) return null;
  const b = transaction.buyerBusiness;
  return {
    name: b.name,
    taxId: b.taxId,
    address: b.address,
    city: b.city,
    country: b.country,
    contactEmail: b.contactEmail,
  };
}
