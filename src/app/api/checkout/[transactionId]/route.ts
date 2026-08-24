import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { requireStripe } from "@/lib/stripe";

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ transactionId: string }> }
) {
  const { transactionId } = await params;
  const session = await auth();
  if (!session?.user?.businessId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const transaction = await prisma.transaction.findUnique({
    where: { id: transactionId },
    include: { listing: true, sellerBusiness: true },
  });
  if (!transaction) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (transaction.buyerBusinessId !== session.user.businessId) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const buyerBusiness = await prisma.business.findUnique({ where: { id: session.user.businessId } });
  if (buyerBusiness?.verificationStatus === "SUSPENDED") {
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
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
  const amountCents = Math.round(transaction.amount * 100);
  const commissionCents = Math.round(transaction.commissionAmount * 100);

  const checkoutSession = await stripe.checkout.sessions.create({
    mode: "payment",
    payment_method_types: ["card"],
    line_items: [
      {
        price_data: {
          currency: "usd",
          unit_amount: amountCents,
          product_data: {
            name: transaction.listing.title,
            description: `${transaction.quantity} x unit — Overstock Trade order ${transaction.id}`,
          },
        },
        quantity: 1,
      },
    ],
    payment_intent_data: {
      capture_method: "manual",
      application_fee_amount: commissionCents,
      transfer_data: { destination: transaction.sellerBusiness.stripeAccountId },
      metadata: { transactionId: transaction.id },
    },
    metadata: { transactionId: transaction.id },
    success_url: `${appUrl}/dashboard/orders/${transaction.id}?checkout=success`,
    cancel_url: `${appUrl}/dashboard/orders/${transaction.id}?checkout=cancelled`,
  });

  await prisma.transaction.update({
    where: { id: transaction.id },
    data: { stripeCheckoutSessionId: checkoutSession.id },
  });

  return NextResponse.json({ url: checkoutSession.url });
}
