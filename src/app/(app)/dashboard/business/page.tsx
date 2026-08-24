import Link from "next/link";
import { requireBusiness } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { stripe } from "@/lib/stripe";
import { ui, badgeColor } from "@/lib/ui";
import BusinessForm from "@/components/BusinessForm";
import ConnectStripeButton from "@/components/ConnectStripeButton";

export default async function BusinessProfilePage({
  searchParams,
}: {
  searchParams: Promise<{ stripe?: string }>;
}) {
  const { business } = await requireBusiness();
  const params = await searchParams;

  if (params.stripe === "return" && business.stripeAccountId && stripe) {
    const account = await stripe.accounts.retrieve(business.stripeAccountId);
    if (account.details_submitted && account.charges_enabled) {
      await prisma.business.update({
        where: { id: business.id },
        data: { stripeOnboarded: true },
      });
      business.stripeOnboarded = true;
    }
  }

  return (
    <div className="mx-auto max-w-2xl px-4 py-10 sm:px-6">
      <h1 className="text-2xl font-semibold text-zinc-900">Business profile</h1>

      <div className={`${ui.card} mt-6 p-4`}>
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-zinc-900">Verification status</p>
            <span className={`${ui.badge} mt-1 ${badgeColor(business.verificationStatus)}`}>
              {business.verificationStatus}
            </span>
          </div>
        </div>
        {business.verificationStatus === "PENDING" && (
          <p className="mt-2 text-sm text-zinc-500">
            You can already list and trade while pending &mdash; buyers just see a
            &ldquo;Not verified&rdquo; notice on your listings until our team reviews your
            business details. Verified sellers tend to convert offers faster.{" "}
            <Link href="/trust-safety" className="text-brand hover:underline">
              What verification means
            </Link>
            .
          </p>
        )}
        {business.verificationStatus === "REJECTED" && (
          <p className="mt-2 text-sm text-zinc-500">
            Your verification wasn&apos;t approved
            {business.verificationNote ? `: ${business.verificationNote}` : "."} Update your
            business details below and our team will take another look.
          </p>
        )}
        {business.verificationStatus === "SUSPENDED" && (
          <p className="mt-2 text-sm text-zinc-500">
            Your account is suspended and can&apos;t list or complete purchases
            {business.verificationNote ? `: ${business.verificationNote}` : "."} Contact
            support if you believe this is a mistake.
          </p>
        )}
      </div>

      <div className={`${ui.card} mt-4 p-4`}>
        <p className="text-sm font-medium text-zinc-900">Payouts</p>
        <p className="mt-1 text-sm text-zinc-500">
          Connect a Stripe account to receive payouts when you sell inventory.
        </p>
        <div className="mt-3">
          {business.stripeOnboarded ? (
            <span className={`${ui.badge} ${badgeColor("VERIFIED")}`}>Stripe connected</span>
          ) : (
            <ConnectStripeButton
              label={business.stripeAccountId ? "Finish Stripe setup" : "Connect Stripe"}
            />
          )}
        </div>
      </div>

      <div className={`${ui.card} mt-6 p-6`}>
        <BusinessForm business={business} />
      </div>

      <p className="mt-4 text-sm text-zinc-500">
        <Link href="/dashboard/account" className="text-brand hover:underline">
          Account settings &amp; delete account
        </Link>
      </p>
    </div>
  );
}
