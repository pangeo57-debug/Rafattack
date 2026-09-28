import { describe, it, expect, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { prisma } from "@/lib/prisma";
import OrderDetailPage from "@/app/(app)/dashboard/orders/[id]/page";
import { makeBusiness, makeListing, actAs } from "./helpers";

// Render the real server page outside Next: notFound() throws like it does in
// Next, and the client buttons get a stub router.
vi.mock("next/navigation", () => ({
  notFound: () => {
    throw new Error("NEXT_NOT_FOUND");
  },
  redirect: (to: string) => {
    throw new Error(`NEXT_REDIRECT ${to}`);
  },
  useRouter: () => ({ push() {}, refresh() {}, replace() {} }),
}));

async function renderOrder(id: string) {
  const el = await OrderDetailPage({ params: Promise.resolve({ id }) });
  return renderToStaticMarkup(el);
}

async function order(paid: boolean) {
  const seller = await makeBusiness();
  const buyer = await makeBusiness();
  await prisma.business.update({
    where: { id: buyer.business.id },
    data: { name: "Buyer Retail ΙΚΕ", taxId: "EL998877665", address: "Ermou 10", contactEmail: "billing@buyer.test" },
  });
  const listing = await makeListing(seller.business.id);
  const offer = await prisma.offer.create({
    data: { listingId: listing.id, buyerBusinessId: buyer.business.id, offeredPriceCents: 1800, quantity: 10, status: "ACCEPTED" },
  });
  const tx = await prisma.transaction.create({
    data: {
      offerId: offer.id, listingId: listing.id, sellerBusinessId: seller.business.id, buyerBusinessId: buyer.business.id,
      quantity: 10, unitPriceCents: 1800, amountCents: 18000, commissionBps: 800, commissionCents: 1440, sellerPayoutCents: 16560,
      ...(paid ? { orderStatus: "PAID" as const, paidAt: new Date() } : {}),
    },
  });
  return { seller, buyer, tx };
}

describe("seller sees the buyer's invoice details on a paid order", () => {
  it("the seller of a paid order sees the buyer's name, tax ID, address and email", async () => {
    const { seller, tx } = await order(true);
    actAs(seller);
    const html = await renderOrder(tx.id);
    expect(html).toContain('data-testid="buyer-billing"');
    expect(html).toContain("Buyer Retail ΙΚΕ");
    expect(html).toContain("EL998877665");
    expect(html).toContain("Ermou 10, Athens, Greece");
    expect(html).toContain("billing@buyer.test");
  });

  it("before payment the seller does not see the buyer's tax ID", async () => {
    const { seller, tx } = await order(false);
    actAs(seller);
    const html = await renderOrder(tx.id);
    expect(html).not.toContain("EL998877665");
    expect(html).toContain("will appear here once the order is paid");
  });

  it("a business that is not part of the order gets not-found, not the tax ID", async () => {
    const { tx } = await order(true);
    const stranger = await makeBusiness();
    actAs(stranger);
    await expect(renderOrder(tx.id)).rejects.toThrow("NEXT_NOT_FOUND");
  });

  it("a buyer without a street address is told to add one", async () => {
    const { buyer, tx } = await order(true);
    await prisma.business.update({ where: { id: buyer.business.id }, data: { address: null } });
    actAs(buyer);
    const html = await renderOrder(tx.id);
    expect(html).not.toContain('data-testid="buyer-billing"');
    expect(html).toContain("Your street address is missing");
  });
});
