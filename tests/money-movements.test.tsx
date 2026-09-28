import { describe, it, expect, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { prisma } from "@/lib/prisma";
import { PATCH as updateTransaction } from "@/app/api/transactions/[id]/route";
import { PATCH as resolveDispute } from "@/app/api/admin/disputes/[id]/route";
import AdminTransactionsPage from "@/app/(app)/admin/transactions/page";
import { retryPending } from "@/lib/money-movements";
import { runOrderTimers } from "@/lib/order-timers";
import { calls, outages, fakeStripe } from "./fake-stripe";
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

async function order(state: Record<string, unknown>) {
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
      paymentStatus: "AUTHORIZED", escrowStatus: "HOLDING", paidAt: new Date(), stripePaymentIntentId: "pi_paid",
      ...state,
    },
  });
  return { seller, buyer, tx };
}

const confirmReceipt = (id: string) => call(updateTransaction, { method: "PATCH", params: { id }, body: { action: "COMPLETE" } });
const movement = () => prisma.moneyMovement.findFirstOrThrow();
/** Make pending movements old enough for the hourly retry to pick up. */
const age = () => prisma.moneyMovement.updateMany({ data: { updatedAt: new Date(Date.now() - 10 * 60_000) } });

describe("a seller payout survives Stripe being down", () => {
  it("the order completes, the payout is kept on record, and the next sweep pays it exactly once", async () => {
    const { buyer, tx } = await order({ orderStatus: "SHIPPED", shippedAt: new Date() });
    outages.transfers.push("fail");
    actAs(buyer);

    const res = await confirmReceipt(tx.id);

    expect(res.status).toBe(200);
    expect((await prisma.transaction.findUniqueOrThrow({ where: { id: tx.id } })).orderStatus).toBe("COMPLETED");
    expect(calls.transfers).toHaveLength(0);
    expect(await movement()).toMatchObject({ kind: "SELLER_PAYOUT", status: "PENDING", attempts: 1, amountCents: 16560 });
    expect((await movement()).lastError).toMatch(/unavailable/);

    await age();
    await retryPending();
    await age();
    await retryPending();

    expect(calls.transfers).toHaveLength(1);
    expect(calls.transfers[0].amount).toBe(16560);
    expect(await movement()).toMatchObject({ status: "SUCCEEDED", stripeObjectId: calls.transfers[0].id });
  });

  it("if Stripe paid but the answer was lost, and Stripe has since forgotten the key, the retry still doesn't pay twice", async () => {
    const { buyer, tx } = await order({ orderStatus: "SHIPPED", shippedAt: new Date() });
    outages.transfers.push("lostResponse");
    actAs(buyer);
    await confirmReceipt(tx.id);
    expect(calls.transfers).toHaveLength(1); // it went through...
    expect((await movement()).status).toBe("PENDING"); // ...but we don't know that

    fakeStripe._forgetIdempotencyKeys(); // more than 24 hours later
    await age();
    await retryPending();

    expect(calls.transfers).toHaveLength(1);
    expect(await movement()).toMatchObject({ status: "SUCCEEDED", stripeObjectId: calls.transfers[0].id });
  });

  it("two retries running at the same moment pay once", async () => {
    const { buyer, tx } = await order({ orderStatus: "SHIPPED", shippedAt: new Date() });
    outages.transfers.push("fail");
    actAs(buyer);
    await confirmReceipt(tx.id);
    fakeStripe._forgetIdempotencyKeys();
    await age();

    await Promise.all([retryPending(), retryPending(), retryPending()]);

    expect(calls.transfers).toHaveLength(1);
  });

  it("after repeated failures it stops, marks FAILED, and the admin sees it", async () => {
    const { buyer, tx } = await order({ orderStatus: "SHIPPED", shippedAt: new Date() });
    outages.transfers.push(...Array(8).fill("fail"));
    actAs(buyer);
    await confirmReceipt(tx.id);
    for (let i = 0; i < 9; i++) {
      await age();
      await retryPending();
    }

    expect(await movement()).toMatchObject({ status: "FAILED", attempts: 8 });
    expect(calls.transfers).toHaveLength(0);

    const admin = await makeBusiness();
    actAs({ user: { ...admin.user, platformRole: "ADMIN" } });
    const html = renderToStaticMarkup(await AdminTransactionsPage());
    expect(html).toContain('data-testid="stuck-payments"');
    expect(html).toContain("Payout to seller");
    expect(html).toContain("FAILED, gave up");
  });
});

describe("refunds are retried the same way", () => {
  it("unshipped order: the refund is recorded with the cancellation and retried", async () => {
    const { tx } = await order({ orderStatus: "PAID", paidAt: new Date(Date.now() - 8 * 86400_000) });
    outages.refunds.push("fail");

    await runOrderTimers();

    expect((await prisma.transaction.findUniqueOrThrow({ where: { id: tx.id } })).orderStatus).toBe("CANCELLED");
    expect(calls.refunds).toHaveLength(0);
    await age();
    await runOrderTimers(); // the same hourly sweep retries it
    expect(calls.refunds).toEqual([expect.objectContaining({ payment_intent: "pi_paid" })]);
    expect((await movement()).status).toBe("SUCCEEDED");
  });

  it("admin resolving a dispute for the buyer refunds once, even on a double click", async () => {
    const { tx } = await order({ orderStatus: "DISPUTED", disputeStatus: "OPEN" });
    const admin = await makeBusiness();
    actAs({ user: { ...admin.user, platformRole: "ADMIN" } });

    const results = await Promise.all(
      [1, 2].map(() => call(resolveDispute, { method: "PATCH", params: { id: tx.id }, body: { resolution: "BUYER", note: "Goods not as described." } }))
    );

    expect(results.map((r) => r.status).sort()).toEqual([200, 400]);
    expect(calls.refunds).toHaveLength(1);
    const events = await prisma.orderEvent.findMany({ where: { transactionId: tx.id } });
    expect(events).toEqual([expect.objectContaining({ fromStatus: "DISPUTED", toStatus: "CANCELLED", actor: "ADMIN", actorUserId: admin.user.id })]);
    expect(events[0].reason).toContain("Goods not as described.");
  });
});
