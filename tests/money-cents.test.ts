import { describe, it, expect } from "vitest";
import { prisma } from "@/lib/prisma";
import { computeAmounts } from "@/lib/commission";
import { POST as createOffer } from "@/app/api/offers/route";
import { POST as createListing } from "@/app/api/listings/route";
import { POST as startCheckout } from "@/app/api/checkout/[transactionId]/route";
import { PATCH as setCommission } from "@/app/api/admin/settings/route";
import { calls } from "./fake-stripe";
import { makeBusiness, makeListing, actAs, call } from "./helpers";

/** Reference: exact rational arithmetic with BigInt, rounding half up. */
function reference(unit: number, qty: number, bps: number) {
  const amount = BigInt(unit) * BigInt(qty);
  const commission = (amount * BigInt(bps) * BigInt(2) + BigInt(10000)) / BigInt(20000); // floor(x + 1/2)
  return { amountCents: Number(amount), commissionCents: Number(commission), sellerPayoutCents: Number(amount - commission) };
}

describe("the pricing function works in whole cents", () => {
  it("matches exact arithmetic for 40,000 price/quantity/commission combinations, and always adds up", () => {
    let checked = 0;
    for (let unit = 1; unit <= 2000; unit += 7) {
      for (const qty of [1, 2, 3, 7, 25, 99, 250, 1000, 4999]) {
        for (const bps of [0, 1, 250, 750, 800, 833, 1000, 10000]) {
          const got = computeAmounts(unit, qty, bps);
          expect(got).toEqual(reference(unit, qty, bps));
          expect(got.commissionCents + got.sellerPayoutCents).toBe(got.amountCents);
          checked++;
        }
      }
    }
    expect(checked).toBeGreaterThan(20000);
  });

  it("rounds a half cent up: 8% of 6.25 = 0.50; 8% of 0.06 = 0.0048 → 0", () => {
    expect(computeAmounts(625, 1, 800).commissionCents).toBe(50);
    expect(computeAmounts(6, 1, 800).commissionCents).toBe(0);
    expect(computeAmounts(1, 1, 5000).commissionCents).toBe(1); // exactly half a cent
  });

  it("refuses anything that isn't a whole number of cents", () => {
    expect(() => computeAmounts(18.5, 1, 800)).toThrow(/integer/);
    expect(() => computeAmounts(1800, 1.5, 800)).toThrow(/integer/);
    expect(() => computeAmounts(1800, 1, 7.5)).toThrow(/integer/);
    expect(() => computeAmounts(-1, 1, 800)).toThrow(/integer/);
  });
});

describe("prices typed by people become exact cents", () => {
  const listingBody = (askingPrice: unknown) => ({
    title: "Mugs", description: "Two hundred mugs.", category: "Home & Garden", photos: [],
    quantityAvailable: 200, unit: "ITEM", condition: "NEW", originalPrice: "5", askingPrice,
    minOrderQty: 1, fulfillment: "BOTH", locationCity: "Athens", locationCountry: "Greece",
  });

  it.each([["0.29", 29], ["18,50", 1850], ["18.5", 1850], ["1000000", 100000000]])("listing price %s → %i cents", async (input, cents) => {
    actAs(await makeBusiness());
    const res = await call(createListing, { body: listingBody(input) });
    expect(res.status).toBe(201);
    expect(res.json.askingPriceCents).toBe(cents);
  });

  it.each([["18.505"], ["-3"], ["0"], ["1e3"], ["abc"], [""]])("refuses listing price %j", async (input) => {
    actAs(await makeBusiness());
    expect((await call(createListing, { body: listingBody(input) })).status).toBe(400);
  });

  it("an offer of 0.29 × 3 is exactly 87 cents on the order, and Stripe is asked for exactly that", async () => {
    const seller = await makeBusiness();
    const buyer = await makeBusiness();
    const listing = await makeListing(seller.business.id, { askingPriceCents: 29 });
    actAs(buyer);
    const res = await call(createOffer, { body: { listingId: listing.id, offeredPrice: "0.01", quantity: 3, buyNow: true } });
    const txId = (res.json.transaction as { id: string }).id;

    const t = await prisma.transaction.findUniqueOrThrow({ where: { id: txId } });
    expect(t).toMatchObject({ unitPriceCents: 29, amountCents: 87, commissionCents: 7, sellerPayoutCents: 80 });

    await call(startCheckout, { params: { transactionId: txId } });
    expect(calls.sessionsCreated[0].amount_total).toBe(87);
  });
});

describe("the database itself keeps the money consistent", () => {
  async function base() {
    const seller = await makeBusiness();
    const buyer = await makeBusiness();
    const listing = await makeListing(seller.business.id);
    const offer = await prisma.offer.create({ data: { listingId: listing.id, buyerBusinessId: buyer.business.id, offeredPriceCents: 1800, quantity: 10 } });
    return { offerId: offer.id, listingId: listing.id, sellerBusinessId: seller.business.id, buyerBusinessId: buyer.business.id, quantity: 10 };
  }

  it("refuses an order whose total isn't unit price × quantity", async () => {
    const b = await base();
    await expect(
      prisma.transaction.create({ data: { ...b, unitPriceCents: 1800, amountCents: 18001, commissionBps: 800, commissionCents: 1440, sellerPayoutCents: 16561 } })
    ).rejects.toThrow(/not unit price/);
  });

  it("refuses a commission/payout split that doesn't add up to the total", async () => {
    const b = await base();
    await expect(
      prisma.transaction.create({ data: { ...b, unitPriceCents: 1800, amountCents: 18000, commissionBps: 800, commissionCents: 1440, sellerPayoutCents: 16561 } })
    ).rejects.toThrow(/Transaction_split_adds_up/);
  });

  it("refuses a zero or negative price", async () => {
    const seller = await makeBusiness();
    await expect(makeListing(seller.business.id, { askingPriceCents: 0 })).rejects.toThrow(/Listing_prices_positive/);
  });
});

describe("commission set by the admin", () => {
  async function asAdmin() {
    const a = await makeBusiness();
    actAs({ user: { ...a.user, platformRole: "ADMIN" } });
  }

  it("7.5% is stored as 750 basis points and used for the next order", async () => {
    await asAdmin();
    expect((await call(setCommission, { method: "PATCH", body: { commissionPercent: "7.5" } })).json.commissionBps).toBe(750);

    const seller = await makeBusiness();
    const buyer = await makeBusiness();
    const listing = await makeListing(seller.business.id, { askingPriceCents: 1000 });
    actAs(buyer);
    const res = await call(createOffer, { body: { listingId: listing.id, offeredPrice: "10", quantity: 1, buyNow: true } });
    expect(res.json.transaction).toMatchObject({ commissionBps: 750, commissionCents: 75, sellerPayoutCents: 925 });
  });

  it.each([["abc"], ["101"], ["-1"], ["7.555"]])("refuses %j", async (value) => {
    await asAdmin();
    expect((await call(setCommission, { method: "PATCH", body: { commissionPercent: value } })).status).toBe(400);
  });
});
