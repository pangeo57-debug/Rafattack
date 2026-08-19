import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireStripe } from "@/lib/stripe";
import { notify } from "@/lib/notify";
import type Stripe from "stripe";

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

  if (event.type === "checkout.session.completed") {
    const session = event.data.object as Stripe.Checkout.Session;
    const transactionId = session.metadata?.transactionId;
    if (transactionId) {
      const transaction = await prisma.transaction.findUnique({ where: { id: transactionId } });
      if (transaction && transaction.orderStatus === "AWAITING_PAYMENT") {
        await prisma.transaction.update({
          where: { id: transactionId },
          data: {
            orderStatus: "PAID",
            paymentStatus: "AUTHORIZED",
            escrowStatus: "HOLDING",
            paidAt: new Date(),
            stripePaymentIntentId:
              typeof session.payment_intent === "string" ? session.payment_intent : undefined,
          },
        });
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
    }
  }

  return NextResponse.json({ received: true });
}
