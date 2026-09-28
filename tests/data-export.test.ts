import { describe, it, expect } from "vitest";
import { prisma } from "@/lib/prisma";
import { GET as exportData } from "@/app/api/account/export/route";
import { makeBusiness, makeListing, actAs, call } from "./helpers";

async function scene() {
  const me = await makeBusiness();
  const other = await makeBusiness();
  await prisma.business.update({ where: { id: other.business.id }, data: { taxId: "EL-OTHER-SECRET", contactEmail: "other-private@x.test" } });
  const myListing = await makeListing(me.business.id, { title: "My pallets of socks" });
  const theirListing = await makeListing(other.business.id, { title: "Their private stock" });
  const offer = await prisma.offer.create({
    data: { listingId: theirListing.id, buyerBusinessId: me.business.id, offeredPriceCents: 1000, quantity: 5, message: "my offer note", status: "ACCEPTED" },
  });
  const tx = await prisma.transaction.create({
    data: {
      offerId: offer.id, listingId: theirListing.id, sellerBusinessId: other.business.id, buyerBusinessId: me.business.id,
      quantity: 5, unitPriceCents: 1000, amountCents: 5000, commissionBps: 800, commissionCents: 400, sellerPayoutCents: 4600, orderStatus: "COMPLETED",
    },
  });
  await prisma.review.create({ data: { transactionId: tx.id, reviewerBusinessId: me.business.id, revieweeBusinessId: other.business.id, rating: 5, comment: "great seller" } });
  // Something of theirs that has nothing to do with me.
  await prisma.savedSearch.create({ data: { businessId: other.business.id, keyword: "their-secret-search" } });
  return { me, other, myListing, tx };
}

describe("GDPR data export", () => {
  it("gives me my own data as a downloadable JSON file", async () => {
    const { me, myListing, tx } = await scene();
    actAs(me);

    const res = await exportData();
    expect(res.status).toBe(200);
    expect(res.headers.get("content-disposition")).toMatch(/^attachment; filename="surplo-data-\d{4}-\d{2}-\d{2}\.json"$/);
    const data = JSON.parse(await res.text());

    expect(data.business.id).toBe(me.business.id);
    expect(data.users.map((u: { email: string }) => u.email)).toEqual([me.user.email]);
    expect(data.listings.map((l: { id: string }) => l.id)).toEqual([myListing.id]);
    expect(data.offersMade[0].message).toBe("my offer note");
    expect(data.purchases.map((t: { id: string }) => t.id)).toEqual([tx.id]);
    expect(data.reviewsGiven[0].comment).toBe("great seller");
  });

  it("never includes my password hash or another business's private details", async () => {
    const { me } = await scene();
    actAs(me);

    const text = await (await exportData()).text();

    expect(text).not.toContain("passwordHash");
    expect(text).not.toContain("EL-OTHER-SECRET");
    expect(text).not.toContain("other-private@x.test");
    expect(text).not.toContain("their-secret-search");
  });

  it("requires being signed in", async () => {
    await scene();
    actAs(null);
    const res = await call(exportData, { method: "GET" });
    expect(res.status).toBe(401);
  });
});
