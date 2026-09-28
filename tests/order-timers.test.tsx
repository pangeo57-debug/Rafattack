import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { prisma } from "@/lib/prisma";
import { POST as cron } from "@/app/api/cron/order-timers/route";
import { POST as startCheckout } from "@/app/api/checkout/[transactionId]/route";
import { PATCH as updateTransaction } from "@/app/api/transactions/[id]/route";
import OrderDetailPage from "@/app/(app)/dashboard/orders/[id]/page";
import { calls, completeSession, fakeStripe } from "./fake-stripe";
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

const HOUR = 3600_000;
const DAY = 24 * HOUR;
const ago = (ms: number) => new Date(Date.now() - ms);

beforeEach(() => {
  process.env.CRON_SECRET = "cron-test-secret";
});

const runTimers = () => call(cron, { headers: { authorization: "Bearer cron-test-secret" } });

/** An order in the given state; the listing already had its units taken. */
async function order(state: Record<string, unknown>) {
  const seller = await makeBusiness();
  const buyer = await makeBusiness();
  const listing = await makeListing(seller.business.id, { quantityAvailable: 0, status: "SOLD_OUT" });
  const offer = await prisma.offer.create({
    data: { listingId: listing.id, buyerBusinessId: buyer.business.id, offeredPrice: 18, quantity: 10, status: "ACCEPTED" },
  });
  const tx = await prisma.transaction.create({
    data: {
      offerId: offer.id, listingId: listing.id, sellerBusinessId: seller.business.id, buyerBusinessId: buyer.business.id,
      quantity: 10, unitPrice: 18, amount: 180, commissionRate: 8, commissionAmount: 14.4, sellerPayoutAmount: 165.6,
      ...state,
    },
  });
  return { seller, buyer, listing, tx };
}

const reload = (id: string) => prisma.transaction.findUniqueOrThrow({ where: { id } });
const stock = async (id: string) => (await prisma.listing.findUniqueOrThrow({ where: { id } })).quantityAvailable;

async function openCheckout(tx: { id: string }, buyer: Awaited<ReturnType<typeof makeBusiness>>) {
  actAs(buyer);
  const res = await call(startCheckout, { params: { transactionId: tx.id } });
  expect(res.status).toBe(200);
  return (await reload(tx.id)).stripeCheckoutSessionId!;
}

describe("unpaid orders expire and release the stock", () => {
  it("an order unpaid after 48 hours is cancelled, its payment page closed, and the units returned", async () => {
    const { buyer, listing, tx } = await order({ createdAt: ago(49 * HOUR) });
    const sessionId = await openCheckout(tx, buyer);

    const res = await runTimers();

    expect(res.json).toMatchObject({ expired: 1 });
    expect((await reload(tx.id)).orderStatus).toBe("CANCELLED");
    expect(calls.sessionsExpired).toEqual([sessionId]);
    expect(await stock(listing.id)).toBe(10);
    expect((await prisma.listing.findUniqueOrThrow({ where: { id: listing.id } })).status).toBe("ACTIVE");
  });

  it("an order still inside its 48 hours is left alone", async () => {
    const { tx, listing } = await order({ createdAt: ago(47 * HOUR) });
    await runTimers();
    expect((await reload(tx.id)).orderStatus).toBe("AWAITING_PAYMENT");
    expect(await stock(listing.id)).toBe(0);
  });

  it("an order whose bank transfer is still clearing is not cancelled under the buyer", async () => {
    const { buyer, tx } = await order({ createdAt: ago(72 * HOUR) });
    const sessionId = await openCheckout(tx, buyer);
    completeSession(sessionId); // SEPA: checkout done, money not yet arrived

    const res = await runTimers();

    expect(res.json).toMatchObject({ expired: 0, skipped: 1 });
    expect((await reload(tx.id)).orderStatus).toBe("AWAITING_PAYMENT");
  });

  it("an order whose payment failed is cancelled once the 48 hours are up", async () => {
    const { buyer, tx } = await order({ createdAt: ago(72 * HOUR) });
    const sessionId = await openCheckout(tx, buyer);
    completeSession(sessionId);
    await prisma.transaction.update({ where: { id: tx.id }, data: { paymentStatus: "FAILED" } });

    await runTimers();

    expect((await reload(tx.id)).orderStatus).toBe("CANCELLED");
  });

  it("after a failed payment the buyer can open a new payment page, as they are told", async () => {
    const { buyer, tx } = await order({});
    const first = await openCheckout(tx, buyer);
    completeSession(first);
    await prisma.transaction.update({ where: { id: tx.id }, data: { paymentStatus: "FAILED" } });

    const retry = await call(startCheckout, { params: { transactionId: tx.id } });

    expect(retry.status).toBe(200);
    const after = await reload(tx.id);
    expect(after.stripeCheckoutSessionId).not.toBe(first);
    expect(after.paymentStatus).toBe("PENDING");
  });
});

describe("paid orders the seller never ships are refunded", () => {
  const paid = (daysAgo: number) => ({
    orderStatus: "PAID", paymentStatus: "AUTHORIZED", escrowStatus: "HOLDING",
    paidAt: ago(daysAgo * DAY), stripePaymentIntentId: "pi_paid",
  });

  it("7 days after payment with no shipment: full refund, once, even if the timer runs twice at once", async () => {
    const { tx, listing } = await order(paid(8));

    await Promise.all([runTimers(), runTimers()]);

    const after = await reload(tx.id);
    expect(after.orderStatus).toBe("CANCELLED");
    expect(after.paymentStatus).toBe("REFUNDED");
    expect(calls.refunds).toEqual([expect.objectContaining({ payment_intent: "pi_paid" })]);
    expect(await stock(listing.id)).toBe(10);
  });

  it("the seller clicking 'Shipped' at the same moment: either shipped or refunded, never both", async () => {
    const { seller, tx } = await order(paid(8));
    actAs(seller);

    const [ship] = await Promise.all([
      call(updateTransaction, { method: "PATCH", params: { id: tx.id }, body: { action: "SHIP" } }),
      runTimers(),
    ]);

    const after = await reload(tx.id);
    if (ship.status === 200) {
      expect(after.orderStatus).toBe("SHIPPED");
      expect(calls.refunds).toHaveLength(0);
    } else {
      expect(after.orderStatus).toBe("CANCELLED");
      expect(calls.refunds).toHaveLength(1);
    }
  });

  it("a seller cannot mark an already refunded order as shipped", async () => {
    const { seller, tx } = await order(paid(8));
    await runTimers();
    actAs(seller);
    const ship = await call(updateTransaction, { method: "PATCH", params: { id: tx.id }, body: { action: "SHIP" } });
    expect(ship.status).toBe(400);
    expect((await reload(tx.id)).orderStatus).toBe("CANCELLED");
  });
});

describe("shipped orders nobody complains about are completed", () => {
  const shipped = (daysAgo: number) => ({
    orderStatus: "SHIPPED", paymentStatus: "AUTHORIZED", escrowStatus: "HOLDING",
    paidAt: ago((daysAgo + 1) * DAY), shippedAt: ago(daysAgo * DAY),
  });

  it("7 days after dispatch the seller is paid, exactly once", async () => {
    const { tx } = await order(shipped(8));

    await Promise.all([runTimers(), runTimers()]);

    expect((await reload(tx.id)).orderStatus).toBe("COMPLETED");
    expect(calls.transfers).toHaveLength(1);
    expect(calls.transfers[0].amount).toBe(16560);
  });

  it("before 7 days nothing happens", async () => {
    const { tx } = await order(shipped(6));
    await runTimers();
    expect((await reload(tx.id)).orderStatus).toBe("SHIPPED");
    expect(calls.transfers).toHaveLength(0);
  });

  it("a disputed order is never completed by the timer", async () => {
    const { tx } = await order({ ...shipped(30), orderStatus: "DISPUTED", disputeStatus: "OPEN" });
    await runTimers();
    expect((await reload(tx.id)).orderStatus).toBe("DISPUTED");
    expect(calls.transfers).toHaveLength(0);
  });

  it("the buyer reporting a problem at the same moment: either disputed or paid out, never both", async () => {
    // Timing decides who wins, so try the collision with the timer starting a
    // little earlier each round.
    for (const delayMs of [0, 2, 5, 10, 20]) {
      const { buyer, seller, tx } = await order(shipped(8));
      actAs(buyer);
      const transfersBefore = calls.transfers.length;

      const [, dispute] = await Promise.all([
        runTimers(),
        new Promise((r) => setTimeout(r, delayMs)).then(() =>
          call(updateTransaction, { method: "PATCH", params: { id: tx.id }, body: { action: "DISPUTE", reason: "wrong goods" } })
        ),
      ]);

      const after = await reload(tx.id);
      const paidOut = calls.transfers.filter((t) => t.destination === seller.business.stripeAccountId).length;
      expect(calls.transfers.length - transfersBefore).toBe(paidOut);
      if (dispute.status === 200) {
        expect(after.orderStatus).toBe("DISPUTED");
        expect(paidOut).toBe(0);
      } else {
        expect(after.orderStatus).toBe("COMPLETED");
        expect(paidOut).toBe(1);
      }
    }
  });
});

describe("the timer endpoint fails closed", () => {
  it("refuses to run when CRON_SECRET is not set", async () => {
    delete process.env.CRON_SECRET;
    const res = await call(cron, { headers: { authorization: "Bearer " } });
    expect(res.status).toBe(503);
  });

  it("refuses a wrong secret and changes nothing", async () => {
    const { tx } = await order({ createdAt: ago(72 * HOUR) });
    const res = await call(cron, { headers: { authorization: "Bearer guess" } });
    expect(res.status).toBe(401);
    expect((await reload(tx.id)).orderStatus).toBe("AWAITING_PAYMENT");
  });
});

describe("the order page tells both sides the deadline", () => {
  const render = async (id: string) =>
    renderToStaticMarkup(await OrderDetailPage({ params: Promise.resolve({ id }) }));

  it("unpaid: buyer is told when to pay by, in Greek time", async () => {
    const { buyer, tx } = await order({ createdAt: new Date("2026-09-28T09:00:00Z") });
    actAs(buyer);
    const html = await render(tx.id);
    expect(html).toContain("Please pay by 30 Sept 2026, 12:00 EEST");
  });

  it("shipped: buyer is told the last moment to report a problem, seller when the payout comes", async () => {
    const { buyer, seller, tx } = await order({
      orderStatus: "SHIPPED", paidAt: new Date("2026-09-27T09:00:00Z"), shippedAt: new Date("2026-09-28T09:00:00Z"),
    });
    actAs(buyer);
    expect(await render(tx.id)).toContain("report a problem before 5 Oct 2026, 12:00 EEST");
    actAs(seller);
    expect(await render(tx.id)).toContain("automatically on 5 Oct 2026, 12:00 EEST");
  });
});

// Keep the fake honest: real Stripe refuses to expire a finished session.
it("fake Stripe refuses to expire a completed session, like the real one", async () => {
  const s = await fakeStripe.checkout.sessions.create({}, undefined);
  completeSession(s.id);
  await expect(fakeStripe.checkout.sessions.expire(s.id)).rejects.toThrow();
});
