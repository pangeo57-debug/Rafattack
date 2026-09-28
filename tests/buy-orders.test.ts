import { describe, it, expect } from "vitest";
import { prisma } from "@/lib/prisma";
import { POST as createBid } from "@/app/api/bids/route";
import { PATCH as changeBid } from "@/app/api/bids/[id]/route";
import { POST as fillBid } from "@/app/api/bids/[id]/fill/route";
import { PATCH as updateTransaction } from "@/app/api/transactions/[id]/route";
import { PATCH as setVerification } from "@/app/api/admin/businesses/[id]/route";
import { runOrderTimers } from "@/lib/order-timers";
import { parseEuroToCents } from "@/lib/money";
import { makeBusiness, makeListing, actAs, call } from "./helpers";

const DAY = 24 * 3600_000;

const bidBody = (o: Record<string, unknown> = {}) => ({
  category: "Apparel & Footwear",
  conditions: ["NEW", "LIKE_NEW"],
  maxUnitPrice: "3.80",
  quantityWanted: 500,
  minLotQty: 50,
  country: "Greece",
  city: "",
  expiresInDays: 30,
  ...o,
});

async function bid(buyer: Awaited<ReturnType<typeof makeBusiness>>, o: Record<string, unknown> = {}) {
  return prisma.buyOrder.create({
    data: {
      buyerBusinessId: buyer.business.id,
      category: "Apparel & Footwear",
      conditions: ["NEW"],
      maxUnitPriceCents: 380,
      quantityWanted: 500,
      remainingQty: 500,
      minLotQty: 50,
      country: "Greece",
      expiresAt: new Date(Date.now() + 30 * DAY),
      ...o,
    },
  });
}

const sell = (bidId: string, listingId: string, extra: Record<string, unknown> = {}) =>
  call(fillBid, { params: { id: bidId }, body: { listingId, ...extra } });

describe("euros to cents without floats", () => {
  it.each([
    ["3.80", 380], ["0.29", 29], ["1,5", 150], ["12", 1200], [4.1, 410],
  ])("%s → %i cents", (input, cents) => expect(parseEuroToCents(input)).toBe(cents));
  it.each(["3.805", "-1", "abc", "", "1e3", "0x10"])("rejects %s", (input) => expect(parseEuroToCents(input)).toBeNull());
});

describe("posting a buy request", () => {
  it("a verified buyer posts one; the price is stored in cents", async () => {
    const buyer = await makeBusiness();
    actAs(buyer);
    const res = await call(createBid, { body: bidBody({ maxUnitPrice: "0.29" }) });
    expect(res.status).toBe(201);
    expect(res.json).toMatchObject({ maxUnitPriceCents: 29, remainingQty: 500, status: "ACTIVE", city: null });
  });

  it("an unverified business cannot: sellers are promised a verified buyer", async () => {
    const buyer = await makeBusiness({ verified: false });
    actAs(buyer);
    expect((await call(createBid, { body: bidBody() })).status).toBe(403);
  });

  it.each([
    [{ maxUnitPrice: "3.805" }],
    [{ maxUnitPrice: "0" }],
    [{ conditions: [] }],
    [{ minLotQty: 600 }],
    [{ category: "Weapons" }],
    [{ expiresInDays: 365 }],
  ])("rejects %j", async (bad) => {
    const buyer = await makeBusiness();
    actAs(buyer);
    expect((await call(createBid, { body: bidBody(bad) })).status).toBe(400);
    expect(await prisma.buyOrder.count()).toBe(0);
  });

  it("tells sellers whose active listings match, and nobody else", async () => {
    const buyer = await makeBusiness();
    const match = await makeBusiness();
    const others = await Promise.all([1, 2, 3, 4].map(() => makeBusiness()));
    await makeListing(match.business.id, { locationCountry: "greece" });
    await makeListing(others[0].business.id, { category: "Electronics", locationCountry: "Greece" });
    await makeListing(others[1].business.id, { locationCountry: "Cyprus" });
    await makeListing(others[2].business.id, { condition: "FAIR", locationCountry: "Greece" });
    await makeListing(others[3].business.id, { quantityAvailable: 10, locationCountry: "Greece" }); // below min lot
    await makeListing(buyer.business.id, { locationCountry: "Greece" }); // their own
    actAs(buyer);

    await call(createBid, { body: bidBody() });

    const told = await prisma.notification.findMany({ where: { title: "A buyer wants your stock" } });
    expect(told.map((n) => n.businessId)).toEqual([match.business.id]);
    expect(told[0].body).toContain("€3.80");
  });
});

describe("selling to a buy request", () => {
  async function scene(listingOverrides: Record<string, unknown> = {}, bidOverrides: Record<string, unknown> = {}) {
    const seller = await makeBusiness();
    const buyer = await makeBusiness();
    const listing = await makeListing(seller.business.id, { quantityAvailable: 300, askingPriceCents: 900, locationCountry: "Greece", ...listingOverrides });
    const b = await bid(buyer, bidOverrides);
    return { seller, buyer, listing, b };
  }

  it("creates an order at the buyer's price for as much as both sides allow", async () => {
    const { seller, buyer, listing, b } = await scene();
    actAs(seller);

    const res = await sell(b.id, listing.id);

    expect(res.status).toBe(201);
    const t = res.json.transaction as Record<string, unknown>;
    expect(t).toMatchObject({ buyerBusinessId: buyer.business.id, sellerBusinessId: seller.business.id, quantity: 300, unitPriceCents: 380, amountCents: 114000, orderStatus: "AWAITING_PAYMENT" });
    expect((await prisma.listing.findUniqueOrThrow({ where: { id: listing.id } })).quantityAvailable).toBe(0);
    expect((await prisma.buyOrder.findUniqueOrThrow({ where: { id: b.id } })).remainingQty).toBe(200);
    const offer = await prisma.offer.findUniqueOrThrow({ where: { id: t.offerId as string } });
    expect(offer.buyOrderId).toBe(b.id);
    expect(await prisma.notification.count({ where: { businessId: buyer.business.id, title: "Your buy request was filled" } })).toBe(1);
  });

  it("ignores any price in the request body", async () => {
    const { seller, listing, b } = await scene();
    actAs(seller);
    const res = await sell(b.id, listing.id, { price: 0.01, offeredPrice: 99, unitPrice: 99, maxUnitPriceCents: 1 });
    expect((res.json.transaction as { unitPriceCents: number }).unitPriceCents).toBe(380);
  });

  it("the request is marked filled once what's left is below the buyer's smallest lot", async () => {
    const { seller, listing, b } = await scene({ quantityAvailable: 480 });
    actAs(seller);
    await sell(b.id, listing.id);
    expect(await prisma.buyOrder.findUniqueOrThrow({ where: { id: b.id } })).toMatchObject({ remainingQty: 20, status: "FILLED" });
  });

  it("someone else's listing, a request that doesn't match, and a missing id all answer the same 404", async () => {
    const { seller, listing, b } = await scene();
    const stranger = await makeBusiness();
    const offCategory = await bid(await makeBusiness(), { category: "Electronics" });

    actAs(stranger);
    const notYours = await sell(b.id, listing.id);
    actAs(seller);
    const noMatch = await sell(offCategory.id, listing.id);
    const missing = await sell("nope", listing.id);

    expect(notYours.status).toBe(404);
    expect(noMatch).toEqual(notYours);
    expect(missing).toEqual(notYours);
    expect(await prisma.transaction.count()).toBe(0);
  });

  it("a paused, expired, or unverified buyer's request can't be sold to", async () => {
    const { seller, listing } = await scene();
    const paused = await bid(await makeBusiness(), { status: "PAUSED" });
    const expired = await bid(await makeBusiness(), { expiresAt: new Date(Date.now() - 1000) });
    const unverified = await bid(await makeBusiness({ verified: false }));
    actAs(seller);
    for (const b of [paused, expired, unverified]) expect((await sell(b.id, listing.id)).status).toBe(404);
  });

  it("a business can't sell to its own buy request", async () => {
    const both = await makeBusiness();
    const listing = await makeListing(both.business.id, { locationCountry: "Greece" });
    const own = await bid(both);
    actAs(both);
    expect((await sell(own.id, listing.id)).status).toBe(404);
    expect(await prisma.transaction.count()).toBe(0);
  });

  it("a seller without payouts set up is told to connect Stripe first", async () => {
    const seller = await makeBusiness({ stripe: false });
    const listing = await makeListing(seller.business.id, { locationCountry: "Greece" });
    const b = await bid(await makeBusiness());
    actAs(seller);
    const res = await sell(b.id, listing.id);
    expect(res.status).toBe(400);
    expect(res.json.error).toMatch(/Stripe/);
  });

  it("quantity outside what both sides allow is refused", async () => {
    const { seller, listing, b } = await scene();
    actAs(seller);
    expect((await sell(b.id, listing.id, { quantity: 10 })).status).toBe(400); // below min lot 50
    expect((await sell(b.id, listing.id, { quantity: 301 })).status).toBe(400); // more than stock
  });
});

describe("no overselling, on either side", () => {
  it("two sellers filling the last 100 units a buyer wants at the same moment: exactly one sale", async () => {
    const buyer = await makeBusiness();
    const b = await bid(buyer, { remainingQty: 100, quantityWanted: 100, minLotQty: 100 });
    const sellers = await Promise.all([1, 2].map(() => makeBusiness()));
    const listings = await Promise.all(sellers.map((s) => makeListing(s.business.id, { quantityAvailable: 100, locationCountry: "Greece" })));

    const results = await Promise.all(
      sellers.map((s, i) => call(fillBid, { params: { id: b.id }, body: { listingId: listings[i].id }, as: s }))
    );

    expect(results.map((r) => r.status).sort()).toEqual([201, 409]);
    expect(await prisma.transaction.count()).toBe(1);
    expect((await prisma.buyOrder.findUniqueOrThrow({ where: { id: b.id } })).remainingQty).toBe(0);
    const stock = await prisma.listing.findMany({ select: { quantityAvailable: true } });
    expect(stock.map((l) => l.quantityAvailable).sort((a, c) => a - c)).toEqual([0, 100]);
  });

  it("one seller filling two requests with stock for one: exactly one sale", async () => {
    const seller = await makeBusiness();
    const listing = await makeListing(seller.business.id, { quantityAvailable: 100, locationCountry: "Greece" });
    const bids = await Promise.all([1, 2].map(async () => bid(await makeBusiness(), { minLotQty: 100 })));
    actAs(seller);

    const results = await Promise.all(bids.map((b) => sell(b.id, listing.id)));

    expect(results.map((r) => r.status).sort()).toEqual([201, 409]);
    expect((await prisma.listing.findUniqueOrThrow({ where: { id: listing.id } })).quantityAvailable).toBe(0);
    const remaining = await prisma.buyOrder.findMany({ select: { remainingQty: true } });
    expect(remaining.map((r) => r.remainingQty).sort((a, c) => a - c)).toEqual([400, 500]);
  });
});

describe("when an order from a request doesn't go through", () => {
  async function filled() {
    const seller = await makeBusiness();
    const buyer = await makeBusiness();
    const listing = await makeListing(seller.business.id, { quantityAvailable: 500, locationCountry: "Greece" });
    const b = await bid(buyer, { minLotQty: 500 });
    actAs(seller);
    const res = await sell(b.id, listing.id);
    const txId = (res.json.transaction as { id: string }).id;
    expect((await prisma.buyOrder.findUniqueOrThrow({ where: { id: b.id } })).status).toBe("FILLED");
    return { seller, buyer, listing, b, txId };
  }
  const reload = (id: string) => prisma.buyOrder.findUniqueOrThrow({ where: { id } });

  it("buyer cancels: units go back and the request is paused, with the reason", async () => {
    const { buyer, b, txId } = await filled();
    actAs(buyer);
    await call(updateTransaction, { method: "PATCH", params: { id: txId }, body: { action: "CANCEL" } });
    expect(await reload(b.id)).toMatchObject({ remainingQty: 500, status: "PAUSED", pausedReason: expect.stringContaining("cancelled") });
    expect(await prisma.notification.count({ where: { businessId: buyer.business.id, title: "Buy request paused" } })).toBe(1);
  });

  it("seller cancels: units go back and the request keeps running", async () => {
    const { seller, b, txId } = await filled();
    actAs(seller);
    await call(updateTransaction, { method: "PATCH", params: { id: txId }, body: { action: "CANCEL" } });
    expect(await reload(b.id)).toMatchObject({ remainingQty: 500, status: "ACTIVE" });
  });

  it("buyer doesn't pay within 48h: units go back and the request is paused", async () => {
    const { b, txId } = await filled();
    await prisma.transaction.update({ where: { id: txId }, data: { createdAt: new Date(Date.now() - 49 * 3600_000) } });
    await runOrderTimers();
    expect(await reload(b.id)).toMatchObject({ remainingQty: 500, status: "PAUSED" });
  });

  it("seller doesn't ship: buyer refunded, request back to running", async () => {
    const { b, txId } = await filled();
    await prisma.transaction.update({
      where: { id: txId },
      data: { orderStatus: "PAID", paidAt: new Date(Date.now() - 8 * DAY), stripePaymentIntentId: "pi_x" },
    });
    await runOrderTimers();
    expect(await reload(b.id)).toMatchObject({ remainingQty: 500, status: "ACTIVE" });
  });
});

describe("managing a request", () => {
  it("the owner can pause, resume and cancel; cancelled is final", async () => {
    const buyer = await makeBusiness();
    const b = await bid(buyer);
    actAs(buyer);
    const act = (action: string) => call(changeBid, { method: "PATCH", params: { id: b.id }, body: { action } });
    expect((await act("PAUSE")).json.status).toBe("PAUSED");
    expect((await act("RESUME")).json.status).toBe("ACTIVE");
    expect((await act("CANCEL")).json.status).toBe("CANCELLED");
    expect((await act("RESUME")).status).toBe(400);
  });

  it("another business can't touch it, and gets the same 404 as a missing id", async () => {
    const b = await bid(await makeBusiness());
    actAs(await makeBusiness());
    const theirs = await call(changeBid, { method: "PATCH", params: { id: b.id }, body: { action: "CANCEL" } });
    const missing = await call(changeBid, { method: "PATCH", params: { id: "nope" }, body: { action: "CANCEL" } });
    expect(theirs.status).toBe(404);
    expect(missing).toEqual(theirs);
    expect((await prisma.buyOrder.findUniqueOrThrow({ where: { id: b.id } })).status).toBe("ACTIVE");
  });

  it("requests past their end date expire in the hourly sweep", async () => {
    const buyer = await makeBusiness();
    const b = await bid(buyer, { expiresAt: new Date(Date.now() - 1000) });
    const res = await runOrderTimers();
    expect(res.buyRequestsExpired).toBe(1);
    expect((await prisma.buyOrder.findUniqueOrThrow({ where: { id: b.id } })).status).toBe("EXPIRED");
  });

  it("suspending a business cancels its open requests", async () => {
    const buyer = await makeBusiness();
    const b = await bid(buyer);
    const admin = await makeBusiness();
    actAs({ user: { ...admin.user, platformRole: "ADMIN" } });
    await call(setVerification, {
      method: "PATCH",
      params: { id: buyer.business.id },
      body: { verificationStatus: "SUSPENDED", verificationNote: "Repeated unpaid orders." },
    });
    expect((await prisma.buyOrder.findUniqueOrThrow({ where: { id: b.id } })).status).toBe("CANCELLED");
  });
});
