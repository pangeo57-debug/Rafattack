import Link from "next/link";
import { ShieldCheck, ShieldAlert, Lock, Flag, RotateCcw } from "lucide-react";

export const metadata = { title: "Trust, Safety & Refunds — Surplo" };

export default function TrustSafetyPage() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-12 text-sm leading-6 text-zinc-700 sm:px-6">
      <h1 className="text-2xl font-semibold text-zinc-900">Trust, Safety &amp; Refund Policy</h1>
      <p className="mt-1 text-zinc-500">Last updated: [DATE]</p>

      <p className="mt-6">
        This page explains how Surplo protects both sides of a trade, what
        &ldquo;Verified&rdquo; means, and what happens if an order goes wrong &mdash; including how to
        report a scam and how refunds work. It supplements our{" "}
        <Link href="/terms" className="text-brand hover:underline">
          Terms of Service
        </Link>
        .
      </p>

      <section className="mt-8">
        <h2 className="flex items-center gap-2 text-lg font-semibold text-zinc-900">
          <Lock className="h-4.5 w-4.5 text-brand" />
          Every payment is escrow-protected
        </h2>
        <p className="mt-2">
          Regardless of verification status, a buyer&apos;s payment is never sent straight to
          the seller. It is authorized and held the moment you pay, and only released to
          the seller after you confirm you received the order &mdash; or if a dispute you
          raised is resolved in the seller&apos;s favor. If you never confirm receipt and no
          resolution favors the seller, the seller is never paid.
        </p>
      </section>

      <section className="mt-8">
        <h2 className="flex items-center gap-2 text-lg font-semibold text-zinc-900">
          <ShieldCheck className="h-4.5 w-4.5 text-emerald-600" />
          What &ldquo;Verified&rdquo; means
        </h2>
        <p className="mt-2">
          A <strong>Verified</strong> business has had its submitted company name, business
          type, location, and tax/VAT ID reviewed by our team and found consistent with a
          real, operating business. It is a review of the information provided, not a
          guarantee of the business&apos;s conduct or the condition of every item it lists.
        </p>
        <p className="mt-2 flex items-start gap-1.5 rounded-lg bg-amber-50 px-3 py-2 text-amber-800">
          <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0" />
          <span>
            A business shown as <strong>Not verified</strong> has not yet been reviewed. You
            can still trade with it &mdash; your payment is still held in escrow &mdash; but you are
            doing so at your own discretion, with less assurance about who you&apos;re dealing
            with. We recommend favoring verified sellers for larger orders, and reviewing a
            business&apos;s ratings and reviews before you buy.
          </span>
        </p>
      </section>

      <section className="mt-8">
        <h2 className="flex items-center gap-2 text-lg font-semibold text-zinc-900">
          <Flag className="h-4.5 w-4.5 text-rose-600" />
          Reporting a problem or suspected scam
        </h2>
        <p className="mt-2">
          If an order hasn&apos;t arrived, doesn&apos;t match its listing, or you believe you&apos;re
          dealing with a fraudulent account, open a dispute from that order&apos;s page (
          <strong>&ldquo;Report a problem with this order&rdquo;</strong>) any time before you confirm
          receipt. This immediately freezes the escrowed funds &mdash; they cannot be
          released to the seller while a dispute is open.
        </p>
        <p className="mt-2">
          Our team reviews the listing, the order details, and any evidence both sides
          provide, then resolves the dispute one of two ways:
        </p>
        <ul className="mt-2 list-disc space-y-1 pl-5">
          <li>
            <strong>Refunded to the buyer</strong> &mdash; the held payment is released back to
            you, and the order is cancelled.
          </li>
          <li>
            <strong>Released to the seller</strong> &mdash; if the evidence shows the order was
            fulfilled as described, the order is marked complete and the seller is paid.
          </li>
        </ul>
        <p className="mt-2">
          Once you confirm receipt yourself, the payment is released immediately and the
          order can no longer be disputed through the platform &mdash; so only confirm receipt
          once you&apos;ve actually checked the goods.
        </p>
      </section>

      <section className="mt-8">
        <h2 className="flex items-center gap-2 text-lg font-semibold text-zinc-900">
          <RotateCcw className="h-4.5 w-4.5 text-brand" />
          All sales are final
        </h2>
        <p className="mt-2">
          Like other B2B liquidation and overstock marketplaces, purchases on Surplo are
          <strong> final once you confirm receipt</strong> &mdash; there is no return window
          for a change of mind, and we do not accept returned goods. Overstock, past-season,
          and returned inventory is sold as described, at a discount that reflects that. It
          is on you, the buyer, to inspect what arrives against the listing before confirming
          receipt.
        </p>
        <p className="mt-2">Refunds only happen in two situations:</p>
        <ul className="mt-2 list-disc space-y-1 pl-5">
          <li>The order is cancelled before payment is confirmed (no dispute needed).</li>
          <li>
            A dispute you opened <em>before confirming receipt</em> is resolved in your favor
            &mdash; e.g. the order never arrived, or what arrived was materially different
            from the listing (wrong item, wrong quantity, undisclosed damage).
          </li>
        </ul>
        <p className="mt-2">
          We do not refund for buyer&apos;s remorse, minor condition variation typical of
          liquidation/returned goods, or anything at all once you&apos;ve confirmed receipt
          &mdash; confirmation is final. Approved refunds go back to the original Stripe
          payment method on Stripe&apos;s standard processing timeline.
        </p>
      </section>

      <section className="mt-8">
        <h2 className="text-lg font-semibold text-zinc-900">Business verification &amp; suspension</h2>
        <p className="mt-2">
          We may suspend an account that receives repeated, substantiated fraud reports,
          fails verification review, or otherwise abuses the platform. Suspended
          businesses cannot list new inventory or complete new purchases. See our{" "}
          <Link href="/terms" className="text-brand hover:underline">
            Terms of Service
          </Link>{" "}
          for the full policy.
        </p>
      </section>

      <section className="mt-8">
        <h2 className="text-lg font-semibold text-zinc-900">Contact</h2>
        <p className="mt-2">
          To report a scam outside an active order, or for anything not covered here,
          contact{" "}
          <a href="mailto:[SUPPORT_EMAIL]" className="text-brand hover:underline">
            [SUPPORT_EMAIL]
          </a>
          .
        </p>
      </section>
    </div>
  );
}
