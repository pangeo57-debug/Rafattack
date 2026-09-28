import { describe, it, expect, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import type { OrderStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { POST as createOffer } from "@/app/api/offers/route";
import { POST as webhook } from "@/app/api/stripe/webhook/route";
import { PATCH as updateTransaction } from "@/app/api/transactions/[id]/route";
import OrderDetailPage from "@/app/(app)/dashboard/orders/[id]/page";
import { TRANSITIONS, transitionNow } from "@/lib/order-status";
import { runOrderTimers } from "@/lib/order-timers";
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

process.env.STRIPE_WEBHOOK_SECRET = "whsec_test";

const events = (transactionId: string) =>
  prisma.orderEvent.findMany({ where: { transactionId }, orderBy: { createdAt: "asc" } });

async function boughtAndPaid() {
  const seller = await makeBusiness();
  const buyer = await makeBusiness();
  const listing = await makeListing(seller.business.id);
  actAs(buyer);
  const res = await call(createOffer, { body: { listingId: listing.id, offeredPrice: 18, quantity: 10, buyNow: true } });
  const txId = (res.json.transaction as { id: string }).id;
  await call(webhook, {
    rawBody: JSON.stringify({
      id: "evt_1",
      type: "checkout.session.completed",
      data: { object: { id: "cs_1", payment_intent: "pi_1", payment_status: "paid", metadata: { transactionId: txId } } },
    }),
    headers: { "stripe-signature": "valid-test-signature" },
  });
  return { seller, buyer, txId };
}

describe("every status change is recorded: who, when, from what to what, why", () => {
  it("a whole order's life is in the log, in order, with the right actor", async () => {
    const { seller, buyer, txId } = await boughtAndPaid();
    actAs(seller);
    await call(updateTransaction, { method: "PATCH", params: { id: txId }, body: { action: "SHIP", carrier: "ACS", trackingNumber: "70123" } });
    actAs(buyer);
    await call(updateTransaction, { method: "PATCH", params: { id: txId }, body: { action: "COMPLETE" } });

    const log = await events(txId);
    expect(log.map((e) => [e.fromStatus, e.toStatus, e.actor, e.actorUserId])).toEqual([
      [null, "AWAITING_PAYMENT", "BUYER", buyer.user.id],
      ["AWAITING_PAYMENT", "PAID", "PAYMENT_PROVIDER", null],
      ["PAID", "SHIPPED", "SELLER", seller.user.id],
      ["SHIPPED", "COMPLETED", "BUYER", buyer.user.id],
    ]);
    expect(log[0].reason).toBe("Bought at the asking price (Buy now)");
    expect(log[1].reason).toContain("pi_1");
    expect(log[2].reason).toBe("Shipped with ACS, tracking 70123");
  });

  it("automatic changes are recorded as automatic, with the reason", async () => {
    const { txId } = await boughtAndPaid();
    await prisma.transaction.update({ where: { id: txId }, data: { paidAt: new Date(Date.now() - 8 * 86400_000) } });
    await runOrderTimers();
    const last = (await events(txId)).at(-1)!;
    expect(last).toMatchObject({ fromStatus: "PAID", toStatus: "CANCELLED", actor: "SYSTEM" });
    expect(last.reason).toMatch(/didn't ship/);
  });

  it("a refused action writes nothing", async () => {
    const { buyer, txId } = await boughtAndPaid();
    actAs(buyer);
    const res = await call(updateTransaction, { method: "PATCH", params: { id: txId }, body: { action: "CANCEL" } });
    expect(res.status).toBe(400); // paid orders can't be cancelled by the buyer
    expect((await events(txId)).map((e) => e.toStatus)).toEqual(["AWAITING_PAYMENT", "PAID"]);
  });

  it("the log can't be edited or deleted", async () => {
    const { txId } = await boughtAndPaid();
    const e = (await events(txId))[0];
    await expect(prisma.orderEvent.update({ where: { id: e.id }, data: { actor: "ADMIN" } })).rejects.toThrow(/append-only/);
    await expect(prisma.orderEvent.delete({ where: { id: e.id } })).rejects.toThrow(/append-only/);
  });

  it("both parties see the history on the order page", async () => {
    const { buyer, txId } = await boughtAndPaid();
    actAs(buyer);
    const html = renderToStaticMarkup(await OrderDetailPage({ params: Promise.resolve({ id: txId }) }));
    expect(html).toContain('data-testid="history"');
    expect(html).toMatch(/Paid \(in escrow\)<\/span> ·(\s|<!-- -->)*by the payment provider/);
  });
});

describe("the allowed moves live in one table", () => {
  it("finished orders can't move anywhere", () => {
    expect(TRANSITIONS.COMPLETED).toEqual([]);
    expect(TRANSITIONS.CANCELLED).toEqual([]);
  });

  it("asking for a move that isn't in the table is a programming error, not a silent change", async () => {
    const { txId } = await boughtAndPaid();
    await expect(
      transitionNow({ id: txId, from: ["COMPLETED" as OrderStatus], to: "PAID", by: { actor: "SYSTEM" } })
    ).rejects.toThrow(/not an allowed transition/);
    expect((await prisma.transaction.findUniqueOrThrow({ where: { id: txId } })).orderStatus).toBe("PAID");
  });
});
