import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { findTransactionAsParty, notFoundResponse } from "@/lib/access";
import { requireStripe } from "@/lib/stripe";
import { isBusinessSuspended } from "@/lib/session";
import { checkRateLimit } from "@/lib/rateLimit";

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ transactionId: string }> }
) {
  const { transactionId } = await params;
  const session = await auth();
  if (!session?.user?.businessId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Every call here hits the Stripe API to create a Checkout Session — cap
  // it so a script can't hammer Stripe (and our API usage) by looping this.
  const allowed = await checkRateLimit(`checkout-session:${session.user.businessId}`, 20, 60);
  if (!allowed) {
    return NextResponse.json(
      { error: "Too many checkout attempts. Please wait a bit and try again." },
      { status: 429 }
    );
  }

  const access = await findTransactionAsParty(transactionId, session.user.businessId);
  if (!access) return notFoundResponse();
  const { transaction, isBuyer } = access;
  if (!isBuyer) {
    return NextResponse.json({ error: "Only the buyer can pay for this order." }, { status: 403 });
  }
  if (await isBusinessSuspended(session.user.businessId)) {
    return NextResponse.json({ error: "Your account is suspended and can't complete purchases." }, { status: 403 });
  }
  if (transaction.orderStatus !== "AWAITING_PAYMENT") {
    return NextResponse.json({ error: "This order has already been paid." }, { status: 400 });
  }
  if (!transaction.sellerBusiness.stripeAccountId || !transaction.sellerBusiness.stripeOnboarded) {
    return NextResponse.json(
      { error: "The seller hasn't finished setting up payouts yet." },
      { status: 400 }
    );
  }

  const stripe = requireStripe();

  // One payable checkout per order at a time. If the buyer already has one
  // open (double click, second tab, came back later), send them to that
  // same page instead of creating a second one they could also pay.
  if (transaction.stripeCheckoutSessionId) {
    const existing = await stripe.checkout.sessions.retrieve(transaction.stripeCheckoutSessionId);
    if (existing.status === "open" && existing.url) {
      return NextResponse.json({ url: existing.url });
    }
    // A completed session whose payment later failed (e.g. a bounced SEPA
    // debit) falls through: the buyer was told to try again.
    if (existing.status === "complete" && transaction.paymentStatus !== "FAILED") {
      return NextResponse.json(
        { error: "Your payment is already being processed for this order." },
        { status: 409 }
      );
    }
  }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
  const amountCents = transaction.amountCents; // computed once, by computeAmounts(), when the order was made

  // Payment is collected into the platform's own Stripe balance (not a Connect
  // destination charge) so that every payment method — card/Apple Pay/Google
  // Pay, PayPal, SEPA bank transfer — can fund escrow the same way, including
  // asynchronous methods that don't support authorize-then-capture. The
  // seller is paid via a separate Transfer once the buyer confirms receipt
  // (see /api/transactions/[id] "COMPLETE") or a dispute is resolved in
  // their favor — see /api/admin/disputes/[id].
  const checkoutSession = await stripe.checkout.sessions.create({
    mode: "payment",
    payment_method_types: ["card", "paypal", "sepa_debit"],
    line_items: [
      {
        price_data: {
          currency: "eur",
          unit_amount: amountCents,
          product_data: {
            name: transaction.listing.title,
            description: `${transaction.quantity} x unit — Surplo order ${transaction.id}`,
          },
        },
        quantity: 1,
      },
    ],
    payment_intent_data: {
      transfer_group: transaction.id,
      metadata: { transactionId: transaction.id },
    },
    metadata: { transactionId: transaction.id },
    success_url: `${appUrl}/dashboard/orders/${transaction.id}?checkout=success`,
    cancel_url: `${appUrl}/dashboard/orders/${transaction.id}?checkout=cancelled`,
  }, {
    // Two simultaneous first clicks both see "no session yet" above; the same
    // key makes Stripe hand both of them the same session rather than two.
    // Keyed on the previous (expired) session so a genuine retry still works.
    idempotencyKey: `checkout-${transaction.id}-${transaction.stripeCheckoutSessionId ?? "first"}`,
  });

  await prisma.transaction.update({
    where: { id: transaction.id },
    data: { stripeCheckoutSessionId: checkoutSession.id, paymentStatus: "PENDING" },
  });

  return NextResponse.json({ url: checkoutSession.url });
}
