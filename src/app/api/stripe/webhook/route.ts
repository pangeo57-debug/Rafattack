import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireStripe } from "@/lib/stripe";
import { transitionNow } from "@/lib/order-status";
import { queueRefund, execute } from "@/lib/money-movements";
import { notify } from "@/lib/notify";
import type Stripe from "stripe";

async function markPaid(session: Stripe.Checkout.Session) {
  const transactionId = session.metadata?.transactionId;
  if (!transactionId) return;
  const paymentIntentId = typeof session.payment_intent === "string" ? session.payment_intent : null;

  // Through the state machine (row lock): only one delivery of one payment
  // can move the order to PAID. A read-then-write here let two concurrent
  // (or duplicate) webhook deliveries both pass the check.
  const was = await transitionNow({
    id: transactionId,
    from: ["AWAITING_PAYMENT"],
    to: "PAID",
    by: { actor: "PAYMENT_PROVIDER" },
    reason: `Payment ${paymentIntentId ?? "(no id)"} confirmed by Stripe`,
    data: { paymentStatus: "AUTHORIZED", escrowStatus: "HOLDING", paidAt: new Date(), stripePaymentIntentId: paymentIntentId },
  });

  if (!was) {
    // Either a repeat delivery of the payment we already recorded (nothing to
    // do), or a *different* payment for an order that is already paid or was
    // cancelled — e.g. a slow SEPA transfer that landed after the buyer also
    // paid by card. That money must go back, not sit silently in our balance.
    const current = await prisma.transaction.findUnique({ where: { id: transactionId } });
    if (current && paymentIntentId && current.stripePaymentIntentId !== paymentIntentId) {
      const refund = await prisma.$transaction((tx) =>
        queueRefund(tx, transactionId, paymentIntentId, `refund-duplicate-${paymentIntentId}`)
      );
      if (refund.status === "PENDING") await execute(refund.id);
      if (refund.attempts === 0) {
        await notify(
          current.buyerBusinessId,
          "ORDER_STATUS_CHANGED",
          "Duplicate payment refunded",
          "We received a second payment for an order that was already paid or cancelled, so we refunded it automatically.",
          `/dashboard/orders/${transactionId}`
        );
      }
    }
    return;
  }

  const transaction = await prisma.transaction.findUniqueOrThrow({ where: { id: transactionId } });
  await notify(
    transaction.sellerBusinessId,
    "PAYMENT_RECEIVED",
    "Payment received",
    "A buyer paid for their order. Funds are held in escrow until they confirm receipt.",
    `/dashboard/orders/${transactionId}`
  );
  await notify(
    transaction.buyerBusinessId,
    "ORDER_STATUS_CHANGED",
    "Payment confirmed",
    "Your payment is held in escrow until you confirm receipt of the order.",
    `/dashboard/orders/${transactionId}`
  );
}

async function markPaymentFailed(session: Stripe.Checkout.Session) {
  const transactionId = session.metadata?.transactionId;
  if (!transactionId) return;

  const updated = await prisma.transaction.updateMany({
    where: { id: transactionId, orderStatus: "AWAITING_PAYMENT", paymentStatus: { not: "FAILED" } },
    data: { paymentStatus: "FAILED" },
  });
  if (updated.count === 0) return;
  const transaction = await prisma.transaction.findUniqueOrThrow({ where: { id: transactionId } });
  await notify(
    transaction.buyerBusinessId,
    "ORDER_STATUS_CHANGED",
    "Payment failed",
    "Your payment method couldn't be charged. You can try paying again from the order page.",
    `/dashboard/orders/${transactionId}`
  );
}

export async function POST(req: NextRequest) {
  const stripe = requireStripe();
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  const signature = req.headers.get("stripe-signature");
  const body = await req.text();

  let event: Stripe.Event;
  try {
    if (!webhookSecret || !signature) throw new Error("Webhook secret not configured");
    event = stripe.webhooks.constructEvent(body, signature, webhookSecret);
  } catch (err) {
    return NextResponse.json(
      { error: `Webhook signature verification failed: ${(err as Error).message}` },
      { status: 400 }
    );
  }

  const session = event.data.object as Stripe.Checkout.Session;

  // Card/wallet payments confirm synchronously; SEPA bank transfers and some
  // other methods confirm asynchronously (up to ~14 business days) via the
  // async_payment_succeeded/failed events instead.
  if (event.type === "checkout.session.completed" && session.payment_status === "paid") {
    await markPaid(session);
  } else if (event.type === "checkout.session.async_payment_succeeded") {
    await markPaid(session);
  } else if (event.type === "checkout.session.async_payment_failed") {
    await markPaymentFailed(session);
  }

  return NextResponse.json({ received: true });
}
