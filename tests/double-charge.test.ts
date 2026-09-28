import { describe, it, expect } from "vitest";
import { prisma } from "@/lib/prisma";
import { POST as startCheckout } from "@/app/api/checkout/[transactionId]/route";
import { POST as webhook } from "@/app/api/stripe/webhook/route";
import { calls } from "./fake-stripe";
import { makeBusiness, makeListing, actAs, call } from "./helpers";

process.env.STRIPE_WEBHOOK_SECRET = "whsec_test";

async function unpaidOrder() {
  const seller = await makeBusiness();
  const buyer = await makeBusiness();
  const listing = await makeListing(seller.business.id);
  const offer = await prisma.offer.create({
    data: { listingId: listing.id, buyerBusinessId: buyer.business.id, offeredPrice: 18, quantity: 10, status: "ACCEPTED" },
  });
  const tx = await prisma.transaction.create({
    data: {
      offerId: offer.id, listingId: listing.id, sellerBusinessId: seller.business.id, buyerBusinessId: buyer.business.id,
      quantity: 10, unitPrice: 18, amount: 180, commissionRate: 8, commissionAmount: 14.4, sellerPayoutAmount: 165.6,
    },
  });
  return { seller, buyer, tx };
}

function sendWebhook(type: string, session: { id: string; payment_intent: string; metadata: Record<string, string> }, paid = true) {
  const body = JSON.stringify({
    id: `evt_${session.id}_${type}`,
    type,
    data: { object: { ...session, payment_status: paid ? "paid" : "unpaid" } },
  });
  return call(webhook, { rawBody: body, headers: { "stripe-signature": "valid-test-signature" } });
}

describe("a buyer can never be charged twice for one order", () => {
  it("clicking Pay twice reuses the same open Stripe checkout instead of opening a second one", async () => {
    const { buyer, tx } = await unpaidOrder();
    actAs(buyer);

    const first = await call(startCheckout, { params: { transactionId: tx.id } });
    const second = await call(startCheckout, { params: { transactionId: tx.id } });

    expect(first.status).toBe(200);
    expect(second.status).toBe(200);
    expect(second.json.url).toBe(first.json.url);
    expect(calls.sessionsCreated).toHaveLength(1);
  });

  it("if a second checkout was paid anyway (e.g. slow SEPA transfer then a card), the extra payment is refunded", async () => {
    const { tx } = await unpaidOrder();
    const meta = { transactionId: tx.id };
    const sepa = { id: "cs_sepa", payment_intent: "pi_sepa", metadata: meta };
    const card = { id: "cs_card", payment_intent: "pi_card", metadata: meta };

    await sendWebhook("checkout.session.completed", card);
    await sendWebhook("checkout.session.async_payment_succeeded", sepa);

    const after = await prisma.transaction.findUniqueOrThrow({ where: { id: tx.id } });
    expect(after.orderStatus).toBe("PAID");
    expect(after.stripePaymentIntentId).toBe("pi_card");
    expect(calls.refunds).toEqual([expect.objectContaining({ payment_intent: "pi_sepa" })]);
  });

  it("the same webhook delivered twice has the same effect as once", async () => {
    const { tx, seller } = await unpaidOrder();
    const s = { id: "cs_1", payment_intent: "pi_1", metadata: { transactionId: tx.id } };

    await Promise.all([sendWebhook("checkout.session.completed", s), sendWebhook("checkout.session.completed", s)]);

    expect(calls.refunds).toHaveLength(0);
    const notes = await prisma.notification.count({ where: { businessId: seller.business.id, type: "PAYMENT_RECEIVED" } });
    expect(notes).toBe(1);
  });

  it("a payment that lands after the buyer cancelled the order is refunded", async () => {
    const { tx } = await unpaidOrder();
    await prisma.transaction.update({ where: { id: tx.id }, data: { orderStatus: "CANCELLED" } });

    await sendWebhook("checkout.session.async_payment_succeeded", {
      id: "cs_late", payment_intent: "pi_late", metadata: { transactionId: tx.id },
    });

    expect((await prisma.transaction.findUniqueOrThrow({ where: { id: tx.id } })).orderStatus).toBe("CANCELLED");
    expect(calls.refunds).toEqual([expect.objectContaining({ payment_intent: "pi_late" })]);
  });

  it("rejects webhooks with a bad signature", async () => {
    const res = await call(webhook, { rawBody: "{}", headers: { "stripe-signature": "forged" } });
    expect(res.status).toBe(400);
  });
});

