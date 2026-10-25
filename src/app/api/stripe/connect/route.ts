import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { requireStripe } from "@/lib/stripe";
import { checkRateLimit } from "@/lib/rateLimit";

export async function POST() {
  const session = await auth();
  if (!session?.user?.businessId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Every call here hits the Stripe API (account creation + account link) —
  // cap it so a script can't hammer Stripe by looping this.
  const allowed = await checkRateLimit(`stripe-connect:${session.user.businessId}`, 10, 60);
  if (!allowed) {
    return NextResponse.json(
      { error: "Too many attempts. Please wait a bit and try again." },
      { status: 429 }
    );
  }

  const stripe = requireStripe();
  const business = await prisma.business.findUniqueOrThrow({
    where: { id: session.user.businessId },
  });

  let accountId = business.stripeAccountId;
  if (!accountId) {
    const account = await stripe.accounts.create({
      type: "express",
      email: business.contactEmail,
      business_type: "company",
      company: { name: business.name },
    });
    accountId = account.id;
    await prisma.business.update({
      where: { id: business.id },
      data: { stripeAccountId: accountId },
    });
  }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
  const accountLink = await stripe.accountLinks.create({
    account: accountId,
    refresh_url: `${appUrl}/dashboard/business?stripe=refresh`,
    return_url: `${appUrl}/dashboard/business?stripe=return`,
    type: "account_onboarding",
  });

  return NextResponse.json({ url: accountLink.url });
}
