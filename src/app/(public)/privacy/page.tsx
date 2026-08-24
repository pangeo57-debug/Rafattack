import Link from "next/link";

export const metadata = { title: "Privacy Policy — Overstock Trade" };

export default function PrivacyPolicyPage() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-12 text-sm leading-6 text-zinc-700 sm:px-6">
      <h1 className="text-2xl font-semibold text-zinc-900">Privacy Policy</h1>
      <p className="mt-1 text-zinc-500">Last updated: [DATE]</p>

      <p className="mt-6">
        [LEGAL ENTITY NAME] (&ldquo;Overstock Trade&rdquo;, &ldquo;we&rdquo;, &ldquo;us&rdquo;) operates the
        Overstock Trade marketplace (the &ldquo;Service&rdquo;), including the mobile app and
        website. This policy explains what information we collect, how we use
        it, and the choices you have. By creating an account you agree to
        this policy.
      </p>

      <h2 className="mt-8 text-lg font-semibold text-zinc-900">1. Who this applies to</h2>
      <p className="mt-2">
        Overstock Trade is a business-to-business (B2B) service. Accounts are
        created on behalf of a business, not an individual consumer. The
        information below applies to the business and to the individual
        person(s) who register and use the account on the business&apos;s
        behalf.
      </p>

      <h2 className="mt-8 text-lg font-semibold text-zinc-900">2. Information we collect</h2>
      <ul className="mt-2 list-disc space-y-1 pl-5">
        <li>
          <strong>Account &amp; business information:</strong> your name and
          email address; your business&apos;s name, type, category, address,
          tax/VAT ID, and contact details.
        </li>
        <li>
          <strong>Listings &amp; transactions:</strong> inventory listings you
          create (title, description, photos, pricing, quantity), offers,
          orders, order status, ratings and reviews you give or receive.
        </li>
        <li>
          <strong>Payment information:</strong> payments and payouts are
          processed by <strong>Stripe, Inc.</strong> We do not store your
          full card number or bank details ourselves — Stripe collects and
          stores that directly. We store the resulting transaction records
          (amounts, status, Stripe identifiers) needed to run the
          marketplace and calculate commission.
        </li>
        <li>
          <strong>Account credentials:</strong> your password is stored only
          as a salted hash — we cannot read your plaintext password.
        </li>
        <li>
          <strong>Usage data:</strong> basic technical data needed to operate
          the Service (e.g. session cookies used to keep you signed in).
          We do not use third-party advertising trackers.
        </li>
      </ul>

      <h2 className="mt-8 text-lg font-semibold text-zinc-900">3. How we use this information</h2>
      <ul className="mt-2 list-disc space-y-1 pl-5">
        <li>To operate your account, listings, offers, orders, and payouts.</li>
        <li>To calculate and collect the platform commission on completed sales.</li>
        <li>To verify businesses and prevent fraud or abuse of the marketplace.</li>
        <li>To send you in-app and, where applicable, email notifications about offers, payments, and order status.</li>
        <li>To show other businesses your public business profile, active listings, and reviews.</li>
        <li>To comply with our legal and tax obligations.</li>
      </ul>

      <h2 className="mt-8 text-lg font-semibold text-zinc-900">4. Who we share it with</h2>
      <ul className="mt-2 list-disc space-y-1 pl-5">
        <li>
          <strong>Stripe</strong> — to process payments and payouts (Stripe
          Connect). See Stripe&apos;s own{" "}
          <a
            href="https://stripe.com/privacy"
            target="_blank"
            rel="noopener noreferrer"
            className="text-brand hover:underline"
          >
            privacy policy
          </a>
          .
        </li>
        <li>
          <strong>Other businesses on the marketplace</strong> — your
          business name, type, location, active listings, and reviews are
          visible to other users, since this is how the marketplace works.
          Your login email and tax/VAT ID are never shown publicly.
        </li>
        <li>
          <strong>Service providers</strong> who host our infrastructure and
          database, bound by confidentiality obligations.
        </li>
        <li>Authorities, where required by law.</li>
      </ul>
      <p className="mt-2">We do not sell your personal information.</p>

      <h2 className="mt-8 text-lg font-semibold text-zinc-900">5. Data retention</h2>
      <p className="mt-2">
        We keep account and transaction data for as long as your account is
        active, plus a period afterward as required for accounting, tax, and
        dispute-resolution purposes. You can request deletion at any time —
        see Section 7.
      </p>

      <h2 className="mt-8 text-lg font-semibold text-zinc-900">6. Your rights</h2>
      <p className="mt-2">
        Depending on where you are located (including under the EU/UK GDPR),
        you may have the right to access, correct, export, or delete your
        personal data, and to object to or restrict certain processing. To
        exercise these rights, contact us at{" "}
        <a href="mailto:[SUPPORT_EMAIL]" className="text-brand hover:underline">
          [SUPPORT_EMAIL]
        </a>
        .
      </p>

      <h2 className="mt-8 text-lg font-semibold text-zinc-900">7. Deleting your account</h2>
      <p className="mt-2">
        You can permanently delete your account and business data at any
        time from{" "}
        <Link href="/dashboard/account" className="text-brand hover:underline">
          Dashboard → Account → Delete account
        </Link>
        . Transaction records tied to completed orders may be retained as
        required by law even after deletion (e.g. for tax/accounting
        purposes), but are no longer linked to an active, usable account.
      </p>

      <h2 className="mt-8 text-lg font-semibold text-zinc-900">8. Children</h2>
      <p className="mt-2">
        The Service is intended for business use by adults and is not
        directed at children under 16. We do not knowingly collect data from
        children.
      </p>

      <h2 className="mt-8 text-lg font-semibold text-zinc-900">9. Changes to this policy</h2>
      <p className="mt-2">
        We may update this policy from time to time. Material changes will
        be posted on this page with an updated &ldquo;Last updated&rdquo; date.
      </p>

      <h2 className="mt-8 text-lg font-semibold text-zinc-900">10. Contact</h2>
      <p className="mt-2">
        [LEGAL ENTITY NAME], [ADDRESS] —{" "}
        <a href="mailto:[SUPPORT_EMAIL]" className="text-brand hover:underline">
          [SUPPORT_EMAIL]
        </a>
      </p>
    </div>
  );
}
