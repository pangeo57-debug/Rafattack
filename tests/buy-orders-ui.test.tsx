import { describe, it, expect, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { prisma } from "@/lib/prisma";
import ListingPage from "@/app/(public)/listings/[id]/page";
import WantedPage from "@/app/(public)/wanted/page";
import BuyRequestsPage from "@/app/(app)/dashboard/bids/page";
import { makeBusiness, makeListing, actAs } from "./helpers";

vi.mock("next/navigation", () => ({
  notFound: () => {
    throw new Error("NEXT_NOT_FOUND");
  },
  redirect: (to: string) => {
    throw new Error(`NEXT_REDIRECT ${to}`);
  },
  useRouter: () => ({ push() {}, refresh() {}, replace() {} }),
}));

const DAY = 24 * 3600_000;

async function request(buyerId: string, o: Record<string, unknown> = {}) {
  return prisma.buyOrder.create({
    data: {
      buyerBusinessId: buyerId,
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

async function scene() {
  const seller = await makeBusiness();
  const buyer = await makeBusiness();
  await prisma.business.update({ where: { id: buyer.business.id }, data: { name: "Secret Outlet ΑΕ", city: "Patras" } });
  const listing = await makeListing(seller.business.id, { quantityAvailable: 300, locationCountry: "Greece" });
  await request(buyer.business.id);
  return { seller, buyer, listing };
}

const renderListing = async (id: string) => renderToStaticMarkup(await ListingPage({ params: Promise.resolve({ id }) }));
const renderWanted = async (category?: string) => renderToStaticMarkup(await WantedPage({ searchParams: Promise.resolve({ category }) }));

describe("the seller sees buyers waiting on their own listing", () => {
  it("shows price, how many units the buyer takes, city, and a sell button, but not the buyer's name", async () => {
    const { seller, listing } = await scene();
    actAs(seller);
    const html = await renderListing(listing.id);
    expect(html).toContain('data-testid="buyers-waiting"');
    expect(html).toContain("1 buyer waiting for this");
    expect(html).toContain("€3.80");
    expect(html).toMatch(/takes up to(\s|<!-- -->)*300/);
    expect(html).toContain("Patras");
    expect(html).toContain("Sell 300 for €1,140.00");
    expect(html).not.toContain("Secret Outlet");
  });

  it("visitors and buyers don't see the panel", async () => {
    const { buyer, listing } = await scene();
    actAs(buyer);
    expect(await renderListing(listing.id)).not.toContain("buyers-waiting");
    actAs(null);
    expect(await renderListing(listing.id)).not.toContain("buyers-waiting");
  });
});

describe("the public Wanted board", () => {
  it("lists open requests from verified buyers without naming them, and totals the demand", async () => {
    const { buyer } = await scene();
    await request(buyer.business.id, { category: "Electronics", maxUnitPriceCents: 1000, remainingQty: 10, quantityWanted: 10, minLotQty: 1 });
    const unverified = await makeBusiness({ verified: false });
    await request(unverified.business.id, { maxUnitPriceCents: 99999 });
    await request(buyer.business.id, { maxUnitPriceCents: 77777, expiresAt: new Date(Date.now() - 1000) });
    await request(buyer.business.id, { maxUnitPriceCents: 66666, status: "PAUSED" });

    const html = await renderWanted();

    expect(html).toContain("€3.80");
    expect(html).toContain("€10.00");
    // 500 × €3.80 + 10 × €10.00 = €2,000.00; the unverified, expired and paused ones don't count.
    expect(html).toContain("€2,000.00");
    expect(html).not.toContain("€999.99");
    expect(html).not.toContain("€777.77");
    expect(html).not.toContain("€666.66");
    expect(html).not.toContain("Secret Outlet");
    expect(html).not.toContain(buyer.business.id);
  });

  it("filters by category, and ignores a category that doesn't exist", async () => {
    const { buyer } = await scene();
    await request(buyer.business.id, { category: "Electronics", maxUnitPriceCents: 1000, remainingQty: 10, quantityWanted: 10, minLotQty: 1 });
    const electronics = await renderWanted("Electronics");
    expect(electronics).toContain("€10.00");
    expect(electronics).not.toContain("€3.80");
    const bogus = await renderWanted("'; DROP TABLE \"BuyOrder\"; --");
    expect(bogus).toContain("€3.80");
    expect(await prisma.buyOrder.count()).toBe(2);
  });
});

describe("the buyer's own requests page", () => {
  it("shows why a request was paused", async () => {
    const buyer = await makeBusiness();
    await request(buyer.business.id, { status: "PAUSED", pausedReason: "An order from this request wasn't paid in time." });
    actAs(buyer);
    const html = renderToStaticMarkup(await BuyRequestsPage());
    expect(html).toContain("wasn&#x27;t paid in time");
    expect(html).toContain("Resume");
  });

  it("an unverified business is told to verify instead of seeing the form", async () => {
    const buyer = await makeBusiness({ verified: false });
    actAs(buyer);
    const html = renderToStaticMarkup(await BuyRequestsPage());
    expect(html).toContain("only verified businesses can post");
    expect(html).not.toContain("Post buy request");
  });
});
