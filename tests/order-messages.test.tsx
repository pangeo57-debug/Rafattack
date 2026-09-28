import { describe, it, expect, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { prisma } from "@/lib/prisma";
import { POST as sendMessage } from "@/app/api/transactions/[id]/messages/route";
import { PATCH as updateTransaction } from "@/app/api/transactions/[id]/route";
import OrderDetailPage from "@/app/(app)/dashboard/orders/[id]/page";
import { offPlatformWarning } from "@/lib/order-messages";
import { makeBusiness, makeListing, actAs, call } from "./helpers";

vi.mock("next/navigation", () => ({
  notFound: () => {
    throw new Error("NEXT_NOT_FOUND");
  },
  redirect: (to: string) => {
    throw new Error(`NEXT_REDIRECT ${to}`);
  },
  useRouter: () => ({ push() {}, refresh() {}, replace() {} }),
}));

async function order(state: Record<string, unknown> = {}) {
  const seller = await makeBusiness();
  const buyer = await makeBusiness();
  const listing = await makeListing(seller.business.id);
  const offer = await prisma.offer.create({
    data: { listingId: listing.id, buyerBusinessId: buyer.business.id, offeredPriceCents: 1800, quantity: 10, status: "ACCEPTED" },
  });
  const tx = await prisma.transaction.create({
    data: {
      offerId: offer.id, listingId: listing.id, sellerBusinessId: seller.business.id, buyerBusinessId: buyer.business.id,
      quantity: 10, unitPriceCents: 1800, amountCents: 18000, commissionBps: 800, commissionCents: 1440, sellerPayoutCents: 16560,
      orderStatus: "PAID", paidAt: new Date(), ...state,
    },
  });
  return { seller, buyer, tx };
}

const say = (id: string, body: unknown) => call(sendMessage, { params: { id }, body: { body } });
const render = async (id: string) => renderToStaticMarkup(await OrderDetailPage({ params: Promise.resolve({ id }) }));

describe("buyer and seller can talk inside the order", () => {
  it("a message is stored, and the other side is notified", async () => {
    const { seller, buyer, tx } = await order();
    actAs(buyer);
    const res = await say(tx.id, "Can I pick up Friday at 10:00?");

    expect(res.status).toBe(201);
    expect(res.json.warning).toBeNull();
    const msgs = await prisma.orderMessage.findMany({ where: { transactionId: tx.id } });
    expect(msgs).toEqual([expect.objectContaining({ senderBusinessId: buyer.business.id, body: "Can I pick up Friday at 10:00?" })]);
    const n = await prisma.notification.findFirstOrThrow({ where: { businessId: seller.business.id, title: "New message about your order" } });
    expect(n.body).toContain("Can I pick up Friday");
  });

  it("both sides see the thread on the order page, labelled from their own point of view", async () => {
    const { seller, buyer, tx } = await order();
    actAs(buyer);
    await say(tx.id, "Can I pick up Friday?");
    actAs(seller);
    await say(tx.id, "Yes, gate 3.");

    const sellerView = await render(tx.id);
    expect(sellerView).toMatch(/Can I pick up Friday\?<\/p><p[^>]*>Buyer/);
    expect(sellerView).toMatch(/Yes, gate 3\.<\/p><p[^>]*>You/);
    actAs(buyer);
    expect(await render(tx.id)).toMatch(/Yes, gate 3\.<\/p><p[^>]*>Seller/);
  });

  it("someone outside the order can't post, and gets the same 404 as for a missing order", async () => {
    const { tx } = await order();
    actAs(await makeBusiness());
    const theirs = await say(tx.id, "hello");
    const missing = await say("nope", "hello");
    expect(theirs.status).toBe(404);
    expect(missing).toEqual(theirs);
    expect(await prisma.orderMessage.count()).toBe(0);
  });

  it.each([[""], ["   "], ["x".repeat(2001)], [42]])("rejects %j", async (body) => {
    const { buyer, tx } = await order();
    actAs(buyer);
    expect((await say(tx.id, body)).status).toBe(400);
  });

  it("warns (but doesn't block) when someone suggests paying outside the platform", async () => {
    const { buyer, tx } = await order();
    actAs(buyer);
    const res = await say(tx.id, "Cheaper if I pay directly, send your IBAN GR16 0110 1250 0000 0001 2300 695");
    expect(res.status).toBe(201);
    expect(res.json.warning).toMatch(/not protected/);
  });
});

describe("the warning helper", () => {
  it.each([
    ["my IBAN is GR1601101250000000012300695", /not protected/],
    ["θα σου κάνω κατάθεση στην τράπεζα", /not protected/],
    ["call me on +30 691 234 5678", /contact details/],
    ["mail orders@shop.gr", /contact details/],
    ["pallets are wrapped, see you at 10", null],
    ["order 25 units of 4 sizes", null],
  ])("%s", (text, expected) => {
    const w = offPlatformWarning(text);
    if (expected === null) expect(w).toBeNull();
    else expect(w).toMatch(expected);
  });
});

describe("messages and moderation decisions can't be changed afterwards", () => {
  it("the database refuses to edit or delete a message", async () => {
    const { buyer, tx } = await order();
    actAs(buyer);
    await say(tx.id, "The boxes arrived damaged.");
    const m = await prisma.orderMessage.findFirstOrThrow();
    await expect(prisma.orderMessage.update({ where: { id: m.id }, data: { body: "All fine!" } })).rejects.toThrow(/append-only/);
    await expect(prisma.orderMessage.delete({ where: { id: m.id } })).rejects.toThrow(/append-only/);
    expect((await prisma.orderMessage.findFirstOrThrow()).body).toBe("The boxes arrived damaged.");
  });

  it("the database refuses to edit a moderation decision", async () => {
    const seller = await makeBusiness();
    const listing = await makeListing(seller.business.id);
    const d = await prisma.moderationDecision.create({
      data: { listingId: listing.id, adminUserId: "admin", ground: "TERMS_VIOLATION", facts: "Counterfeit goods." },
    });
    await expect(prisma.moderationDecision.update({ where: { id: d.id }, data: { facts: "nothing" } })).rejects.toThrow(/append-only/);
  });
});

describe("shipping needs proof of dispatch", () => {
  const ship = (id: string, body: Record<string, unknown>) =>
    call(updateTransaction, { method: "PATCH", params: { id }, body: { action: "SHIP", ...body } });

  it("refuses 'shipped' without a carrier, and the order stays paid", async () => {
    const { seller, tx } = await order();
    actAs(seller);
    expect((await ship(tx.id, {})).status).toBe(400);
    expect((await ship(tx.id, { carrier: " " })).status).toBe(400);
    expect((await prisma.transaction.findUniqueOrThrow({ where: { id: tx.id } })).orderStatus).toBe("PAID");
  });

  it("stores carrier and tracking, tells the buyer, and shows them on the order", async () => {
    const { seller, buyer, tx } = await order();
    actAs(seller);
    const res = await ship(tx.id, { carrier: "ACS", trackingNumber: "7012345678" });

    expect(res.status).toBe(200);
    expect(await prisma.transaction.findUniqueOrThrow({ where: { id: tx.id } })).toMatchObject({
      orderStatus: "SHIPPED", carrier: "ACS", trackingNumber: "7012345678",
    });
    const n = await prisma.notification.findFirstOrThrow({ where: { businessId: buyer.business.id, title: "Order shipped" } });
    expect(n.body).toContain("ACS (tracking 7012345678)");
    actAs(buyer);
    expect(await render(tx.id)).toContain("ACS · tracking 7012345678");
  });

  it("pickup needs no carrier", async () => {
    const { seller, tx } = await order();
    actAs(seller);
    const res = await call(updateTransaction, { method: "PATCH", params: { id: tx.id }, body: { action: "MARK_PICKED_UP" } });
    expect(res.status).toBe(200);
  });
});
