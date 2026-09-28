import { describe, it, expect } from "vitest";
import { prisma } from "@/lib/prisma";
import { POST as createOffer } from "@/app/api/offers/route";
import { PATCH as respondToOffer } from "@/app/api/offers/[id]/route";
import { PATCH as updateTransaction } from "@/app/api/transactions/[id]/route";
import { calls } from "./fake-stripe";
import { makeBusiness, makeListing, actAs, call } from "./helpers";

describe("no double sale: the last item goes to exactly one buyer", () => {
  it("two buyers hitting 'Buy now' at the same moment for the last unit", async () => {
    const seller = await makeBusiness();
    const buyerA = await makeBusiness();
    const buyerB = await makeBusiness();
    const listing = await makeListing(seller.business.id, { quantityAvailable: 1 });

    // Both requests read the listing (qty 1) before either writes.
    const a = call(createOffer, { body: { listingId: listing.id, offeredPrice: 18, quantity: 1, buyNow: true }, as: buyerA });
    const b = call(createOffer, { body: { listingId: listing.id, offeredPrice: 18, quantity: 1, buyNow: true }, as: buyerB });
    const results = await Promise.all([a, b]);

    expect(results.map((r) => r.status).sort()).toEqual([201, 409]);
    expect(await prisma.transaction.count({ where: { listingId: listing.id } })).toBe(1);
    const after = await prisma.listing.findUniqueOrThrow({ where: { id: listing.id } });
    expect(after.quantityAvailable).toBe(0);
    expect(after.status).toBe("SOLD_OUT");
  });

  it("seller accepting two offers at once cannot sell more than is in stock", async () => {
    const seller = await makeBusiness();
    const buyer = await makeBusiness();
    const listing = await makeListing(seller.business.id, { quantityAvailable: 100 });
    const offers = await Promise.all(
      [1, 2].map(() =>
        prisma.offer.create({
          data: { listingId: listing.id, buyerBusinessId: buyer.business.id, offeredPrice: 18, quantity: 60 },
        })
      )
    );

    actAs(seller);
    const results = await Promise.all(
      offers.map((o) => call(respondToOffer, { method: "PATCH", params: { id: o.id }, body: { action: "ACCEPT" } }))
    );

    expect(results.map((r) => r.status).sort()).toEqual([200, 409]);
    const after = await prisma.listing.findUniqueOrThrow({ where: { id: listing.id } });
    expect(after.quantityAvailable).toBe(40);
  });
});

describe("no double payout", () => {
  it("two 'Confirm receipt' clicks at once pay the seller exactly once", async () => {
    const seller = await makeBusiness();
    const buyer = await makeBusiness();
    const listing = await makeListing(seller.business.id);
    const offer = await prisma.offer.create({
      data: { listingId: listing.id, buyerBusinessId: buyer.business.id, offeredPrice: 18, quantity: 10, status: "ACCEPTED" },
    });
    const tx = await prisma.transaction.create({
      data: {
        offerId: offer.id, listingId: listing.id, sellerBusinessId: seller.business.id, buyerBusinessId: buyer.business.id,
        quantity: 10, unitPrice: 18, amount: 180, commissionRate: 8, commissionAmount: 14.4, sellerPayoutAmount: 165.6,
        orderStatus: "SHIPPED", paymentStatus: "AUTHORIZED", escrowStatus: "HOLDING",
      },
    });

    actAs(buyer);
    const results = await Promise.all(
      [1, 2].map(() => call(updateTransaction, { method: "PATCH", params: { id: tx.id }, body: { action: "COMPLETE" } }))
    );

    expect(results.map((r) => r.status).sort()).toEqual([200, 400]);
    expect(calls.transfers).toHaveLength(1);
    expect(calls.transfers[0].amount).toBe(16560);
  });
});

describe("reserved stock is released", () => {
  it("cancelling an unpaid order puts the units back on the listing", async () => {
    const seller = await makeBusiness();
    const buyer = await makeBusiness();
    const listing = await makeListing(seller.business.id, { quantityAvailable: 100 });

    actAs(buyer);
    const bought = await call(createOffer, { body: { listingId: listing.id, offeredPrice: 18, quantity: 100, buyNow: true } });
    const txId = (bought.json.transaction as { id: string }).id;
    const soldOut = await prisma.listing.findUniqueOrThrow({ where: { id: listing.id } });
    expect(soldOut.quantityAvailable).toBe(0);
    expect(soldOut.status).toBe("SOLD_OUT");

    // Cancel twice at once: stock must come back exactly once.
    const results = await Promise.all(
      [1, 2].map(() => call(updateTransaction, { method: "PATCH", params: { id: txId }, body: { action: "CANCEL" } }))
    );
    expect(results.map((r) => r.status).sort()).toEqual([200, 400]);

    const after = await prisma.listing.findUniqueOrThrow({ where: { id: listing.id } });
    expect(after.quantityAvailable).toBe(100);
    expect(after.status).toBe("ACTIVE");
  });
});
