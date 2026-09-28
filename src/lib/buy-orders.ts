import { z } from "zod";
import type { BuyOrder, Listing, ListingCondition, Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { notify } from "@/lib/notify";
import { parseEuroToCents, formatCents } from "@/lib/money";
import { LISTING_CATEGORIES } from "@/lib/constants";
import { acceptOfferAndCreateTransaction, InsufficientStockError, BuyOrderUnavailableError } from "@/lib/offers";

// Standing buy requests, in one place: what a valid request is, which
// listings and requests match, and how a seller fills one.

export const MAX_ACTIVE_BUY_ORDERS = 20;
export const EXPIRY_DAYS = [7, 30, 90] as const;

const CONDITIONS = ["NEW", "LIKE_NEW", "GOOD", "FAIR", "CUSTOMER_RETURNS"] as const;

export const buyOrderSchema = z
  .object({
    category: z.enum(LISTING_CATEGORIES as [string, ...string[]], { error: "Choose a category." }),
    conditions: z.array(z.enum(CONDITIONS)).min(1, "Choose at least one condition you accept."),
    maxUnitPrice: z.union([z.string(), z.number()]),
    quantityWanted: z.coerce.number().int().min(1).max(1_000_000),
    minLotQty: z.coerce.number().int().min(1),
    country: z.string().trim().min(2).max(80),
    city: z.string().trim().max(80).optional().transform((c) => (c ? c : null)),
    expiresInDays: z.coerce.number().refine((d) => (EXPIRY_DAYS as readonly number[]).includes(d), "Choose 7, 30 or 90 days."),
  })
  .transform((d, ctx) => {
    const cents = parseEuroToCents(d.maxUnitPrice);
    if (cents === null || cents < 1 || cents > 100_000_000) {
      ctx.addIssue({ code: "custom", message: "Enter a price per unit like 3.80." });
      return z.NEVER;
    }
    if (d.minLotQty > d.quantityWanted) {
      ctx.addIssue({ code: "custom", message: "The smallest lot can't be bigger than the total quantity." });
      return z.NEVER;
    }
    return { ...d, maxUnitPriceCents: cents, conditions: [...new Set(d.conditions)] };
  });

const ci = (s: string) => ({ equals: s, mode: "insensitive" as const });

/** Units a request would take from a listing, or 0 if it can't be filled. */
export function fillableQty(bid: Pick<BuyOrder, "remainingQty" | "minLotQty">, listing: Pick<Listing, "quantityAvailable" | "minOrderQty">) {
  const qty = Math.min(bid.remainingQty, listing.quantityAvailable);
  return qty >= Math.max(bid.minLotQty, listing.minOrderQty) ? qty : 0;
}

/** Open requests this listing can be sold to, best price first. */
export async function matchingBuyOrders(listing: Listing, now = new Date()) {
  if (listing.status !== "ACTIVE") return [];
  const bids = await prisma.buyOrder.findMany({
    where: {
      status: "ACTIVE",
      expiresAt: { gt: now },
      category: listing.category,
      conditions: { has: listing.condition },
      country: ci(listing.locationCountry),
      OR: [{ city: null }, { city: ci(listing.locationCity) }],
      buyerBusinessId: { not: listing.sellerBusinessId },
      buyerBusiness: { verificationStatus: "VERIFIED", deletedAt: null },
    },
    orderBy: [{ maxUnitPriceCents: "desc" }, { createdAt: "asc" }],
    take: 50,
  });
  return bids.map((bid) => ({ bid, qty: fillableQty(bid, listing) })).filter((m) => m.qty > 0);
}

/** Active listings a new request could buy from (to tell their sellers). */
export async function matchingListings(bid: BuyOrder) {
  const where: Prisma.ListingWhereInput = {
    status: "ACTIVE",
    category: bid.category,
    condition: { in: bid.conditions as ListingCondition[] },
    locationCountry: ci(bid.country),
    ...(bid.city ? { locationCity: ci(bid.city) } : {}),
    sellerBusinessId: { not: bid.buyerBusinessId },
  };
  const listings = await prisma.listing.findMany({ where, take: 50 });
  return listings.filter((l) => fillableQty(bid, l) > 0);
}

export async function notifySellersOfNewBuyOrder(bid: BuyOrder) {
  const listings = await matchingListings(bid);
  const price = formatCents(bid.maxUnitPriceCents, bid.currency);
  for (const l of listings) {
    await notify(
      l.sellerBusinessId,
      "LISTING_MATCH",
      "A buyer wants your stock",
      `A verified buyer will pay ${price} per unit for up to ${fillableQty(bid, l)} of "${l.title}". Sell in one click from your listing.`,
      `/listings/${l.id}`
    );
  }
}

export class FillError extends Error {
  constructor(message: string, public status: number) {
    super(message);
  }
}

/**
 * The seller of `listingId` sells to request `buyOrderId` at the request's
 * price. Everything that decides money comes from the database: price from
 * the request, quantity capped by both sides. Returns the new order.
 */
export async function fillBuyOrder(input: { buyOrderId: string; listingId: string; sellerBusinessId: string; sellerUserId?: string; quantity?: number }) {
  const listing = await prisma.listing.findUnique({ where: { id: input.listingId }, include: { sellerBusiness: true } });
  const bid = await prisma.buyOrder.findUnique({ where: { id: input.buyOrderId } });
  // Not your listing, or a request that doesn't match it: same answer as
  // "doesn't exist", so request ids can't be probed.
  if (!listing || listing.sellerBusinessId !== input.sellerBusinessId || !bid) throw new FillError("Not found", 404);
  const match = (await matchingBuyOrders(listing)).find((m) => m.bid.id === bid.id);
  if (!match) throw new FillError("Not found", 404);

  if (!listing.sellerBusiness.stripeAccountId || !listing.sellerBusiness.stripeOnboarded) {
    throw new FillError("Connect payouts (Stripe) in your business profile before selling, so the buyer can pay you.", 400);
  }

  const minQty = Math.max(bid.minLotQty, listing.minOrderQty);
  const qty = input.quantity ?? match.qty;
  if (!Number.isInteger(qty) || qty < minQty || qty > match.qty) {
    throw new FillError(`Sell between ${minQty} and ${match.qty} units to this buyer.`, 400);
  }

  const unitPrice = bid.maxUnitPriceCents / 100;
  const offer = await prisma.offer.create({
    data: {
      listingId: listing.id,
      buyerBusinessId: bid.buyerBusinessId,
      buyOrderId: bid.id,
      offeredPrice: unitPrice,
      quantity: qty,
      message: "Sold to your standing buy request.",
      status: "PENDING",
    },
  });
  try {
    return await acceptOfferAndCreateTransaction(offer, listing, unitPrice, qty, {
      buyOrderId: bid.id,
      by: { actor: "SELLER", userId: input.sellerUserId ?? null },
      reason: "Seller sold to the buyer's standing buy request",
    });
  } catch (err) {
    if (err instanceof InsufficientStockError || err instanceof BuyOrderUnavailableError) {
      await prisma.offer.update({ where: { id: offer.id }, data: { status: "WITHDRAWN" } });
      throw new FillError(err.message, 409);
    }
    throw err;
  }
}

type Tx = Parameters<Parameters<typeof prisma.$transaction>[0]>[0];

/**
 * An order from a request was cancelled or refunded: the units were not
 * bought, so they go back on the request. If the buyer is the reason (didn't
 * pay, cancelled), the request is paused so sellers aren't sent to a buyer
 * who doesn't follow through; the buyer can resume it.
 */
export async function returnUnitsToBuyOrder(tx: Tx, transactionId: string, pauseReason: string | null) {
  const t = await tx.transaction.findUniqueOrThrow({ where: { id: transactionId }, include: { offer: true } });
  if (!t.offer.buyOrderId) return null;
  const bid = await tx.buyOrder.update({
    where: { id: t.offer.buyOrderId },
    data: { remainingQty: { increment: t.quantity } },
  });
  if (pauseReason && (bid.status === "ACTIVE" || bid.status === "FILLED")) {
    await tx.buyOrder.update({ where: { id: bid.id }, data: { status: "PAUSED", pausedReason: pauseReason } });
  } else if (bid.status === "FILLED" && bid.remainingQty >= bid.minLotQty) {
    await tx.buyOrder.update({ where: { id: bid.id }, data: { status: "ACTIVE" } });
  }
  return bid;
}

/** Requests past their end date stop matching; tell the buyer. */
export async function expireBuyOrders(now = new Date()) {
  const due = await prisma.buyOrder.findMany({ where: { status: { in: ["ACTIVE", "PAUSED"] }, expiresAt: { lte: now } } });
  let expired = 0;
  for (const b of due) {
    const claim = await prisma.buyOrder.updateMany({
      where: { id: b.id, status: { in: ["ACTIVE", "PAUSED"] } },
      data: { status: "EXPIRED" },
    });
    if (claim.count === 0) continue;
    expired++;
    await notify(
      b.buyerBusinessId,
      "OFFER_UPDATED",
      "Buy request expired",
      `Your buy request for ${b.category} at ${formatCents(b.maxUnitPriceCents, b.currency)}/unit has ended. Post a new one if you still need stock.`,
      "/dashboard/bids"
    );
  }
  return expired;
}
