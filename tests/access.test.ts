import { describe, it, expect } from "vitest";
import { prisma } from "@/lib/prisma";
import { POST as startCheckout } from "@/app/api/checkout/[transactionId]/route";
import { PATCH as editListing, DELETE as deleteListing } from "@/app/api/listings/[id]/route";
import { PATCH as respondToOffer } from "@/app/api/offers/[id]/route";
import { PATCH as updateTransaction } from "@/app/api/transactions/[id]/route";
import { POST as createReview } from "@/app/api/reviews/route";
import { PATCH as readNotification } from "@/app/api/notifications/[id]/route";
import { DELETE as deleteSavedSearch } from "@/app/api/saved-searches/[id]/route";
import { makeBusiness, makeListing, actAs, call } from "./helpers";

// For every endpoint that takes an object id: a stranger using someone
// else's real id must get exactly the same answer as for an id that does
// not exist (so ids can't be probed), and nothing may change.

async function world() {
  const seller = await makeBusiness();
  const buyer = await makeBusiness();
  const stranger = await makeBusiness();
  const listing = await makeListing(seller.business.id);
  const offer = await prisma.offer.create({
    data: { listingId: listing.id, buyerBusinessId: buyer.business.id, offeredPriceCents: 1800, quantity: 5 },
  });
  const tx = await prisma.transaction.create({
    data: {
      offerId: offer.id, listingId: listing.id, sellerBusinessId: seller.business.id, buyerBusinessId: buyer.business.id,
      quantity: 5, unitPriceCents: 1800, amountCents: 9000, commissionBps: 800, commissionCents: 720, sellerPayoutCents: 8280,
      orderStatus: "COMPLETED",
    },
  });
  const note = await prisma.notification.create({
    data: { businessId: buyer.business.id, type: "OFFER_UPDATED", title: "t", body: "b" },
  });
  const search = await prisma.savedSearch.create({ data: { businessId: buyer.business.id, keyword: "jackets" } });
  return { seller, buyer, stranger, listing, offer, tx, note, search };
}

const MISSING = "does-not-exist-0000";

async function expectIndistinguishable(
  run: (id: string) => Promise<{ status: number; json: unknown }>,
  realId: string
) {
  const onReal = await run(realId);
  const onMissing = await run(MISSING);
  expect(onReal).toEqual(onMissing);
  expect(onReal.status).toBe(404);
}

describe("a stranger can't see, change or even detect other businesses' objects by id", () => {
  it("listing edit / delete", async () => {
    const w = await world();
    actAs(w.stranger);
    await expectIndistinguishable((id) => call(editListing, { method: "PATCH", params: { id }, body: { status: "PAUSED" } }), w.listing.id);
    await expectIndistinguishable((id) => call(deleteListing, { method: "DELETE", params: { id } }), w.listing.id);
    expect((await prisma.listing.findUniqueOrThrow({ where: { id: w.listing.id } })).status).toBe("ACTIVE");
  });

  it("offer respond", async () => {
    const w = await world();
    actAs(w.stranger);
    await expectIndistinguishable((id) => call(respondToOffer, { method: "PATCH", params: { id }, body: { action: "REJECT" } }), w.offer.id);
    expect((await prisma.offer.findUniqueOrThrow({ where: { id: w.offer.id } })).status).toBe("PENDING");
  });

  it("order actions and checkout", async () => {
    const w = await world();
    actAs(w.stranger);
    await expectIndistinguishable((id) => call(updateTransaction, { method: "PATCH", params: { id }, body: { action: "DISPUTE" } }), w.tx.id);
    await expectIndistinguishable((id) => call(startCheckout, { params: { transactionId: id } }), w.tx.id);
    expect((await prisma.transaction.findUniqueOrThrow({ where: { id: w.tx.id } })).orderStatus).toBe("COMPLETED");
  });

  it("reviews", async () => {
    const w = await world();
    actAs(w.stranger);
    await expectIndistinguishable((id) => call(createReview, { body: { transactionId: id, rating: 1, comment: "x" } }), w.tx.id);
    expect(await prisma.review.count()).toBe(0);
  });

  it("notifications and saved searches", async () => {
    const w = await world();
    actAs(w.stranger);
    await expectIndistinguishable((id) => call(readNotification, { method: "PATCH", params: { id } }), w.note.id);
    await expectIndistinguishable((id) => call(deleteSavedSearch, { method: "DELETE", params: { id } }), w.search.id);
    expect(await prisma.savedSearch.count()).toBe(1);
  });

  it("the rightful owner still gets through", async () => {
    const w = await world();
    actAs(w.seller);
    const res = await call(editListing, { method: "PATCH", params: { id: w.listing.id }, body: { status: "PAUSED" } });
    expect(res.status).toBe(200);
  });
});

describe("listing status changes from the browser are limited to pause/resume", () => {
  it("a seller can't bring a sold-out or removed listing back to life", async () => {
    const seller = await makeBusiness();
    actAs(seller);
    for (const status of ["SOLD_OUT", "REMOVED", "EXPIRED"] as const) {
      const listing = await makeListing(seller.business.id, { status });
      const res = await call(editListing, { method: "PATCH", params: { id: listing.id }, body: { status: "ACTIVE" } });
      expect(res.status).toBe(400);
      expect((await prisma.listing.findUniqueOrThrow({ where: { id: listing.id } })).status).toBe(status);
    }
  });

  it("a seller can't set a system-only status", async () => {
    const seller = await makeBusiness();
    actAs(seller);
    const listing = await makeListing(seller.business.id);
    const res = await call(editListing, { method: "PATCH", params: { id: listing.id }, body: { status: "SOLD_OUT" } });
    expect(res.status).toBe(400);
  });
});
