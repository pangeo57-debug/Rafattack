export const metadata = { title: "Terms of Service — Overstock Trade" };

export default function TermsPage() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-12 text-sm leading-6 text-slate-700 sm:px-6">
      <h1 className="text-2xl font-semibold text-slate-900">Terms of Service</h1>
      <p className="mt-1 text-slate-500">Last updated: [DATE]</p>

      <p className="mt-6">
        These Terms of Service (&ldquo;Terms&rdquo;) govern your business&apos;s use of
        Overstock Trade (the &ldquo;Service&rdquo;), operated by [LEGAL ENTITY NAME]
        (&ldquo;we&rdquo;, &ldquo;us&rdquo;). By creating an account you agree to these Terms.
      </p>

      <h2 className="mt-8 text-lg font-semibold text-slate-900">1. What Overstock Trade is</h2>
      <p className="mt-2">
        Overstock Trade is a business-to-business marketplace that lets
        registered businesses list excess or overstock inventory for sale
        and lets other registered businesses browse, negotiate, and pay for
        that inventory. We are a marketplace and payment facilitator — we
        are not the buyer or seller of any listed inventory, and we are not
        a party to the sale contract between a buyer and a seller.
      </p>

      <h2 className="mt-8 text-lg font-semibold text-slate-900">2. Eligibility &amp; accounts</h2>
      <ul className="mt-2 list-disc space-y-1 pl-5">
        <li>You must be creating an account on behalf of a genuine, legally operating business.</li>
        <li>The information you provide during signup and verification must be accurate and kept up to date.</li>
        <li>You are responsible for activity that happens under your account and for keeping your login credentials secure.</li>
        <li>
          New businesses start in <strong>Pending</strong> verification and
          may be limited in what they can do until verified. We may reject
          or suspend a business at our discretion, including for failed
          verification, fraud, or abuse of the Service.
        </li>
      </ul>

      <h2 className="mt-8 text-lg font-semibold text-slate-900">3. Listings</h2>
      <ul className="mt-2 list-disc space-y-1 pl-5">
        <li>Sellers are solely responsible for the accuracy of their listings (description, condition, quantity, pricing, and photos) and for having the legal right to sell the listed inventory.</li>
        <li>Prohibited, counterfeit, stolen, recalled, or unsafe goods may not be listed.</li>
        <li>We may remove a listing or suspend an account that violates these Terms or applicable law.</li>
      </ul>

      <h2 className="mt-8 text-lg font-semibold text-slate-900">4. Offers &amp; orders</h2>
      <p className="mt-2">
        Buyers may purchase at the listed price or submit an offer. A sale is
        formed once a seller accepts an offer (or a buyer accepts a
        counter-offer) and the buyer completes payment. Order status,
        fulfillment (pickup or shipping arranged directly between the
        parties), and any disputes about the physical goods are the
        responsibility of the buyer and seller — we facilitate the
        transaction and hold payment in escrow, but do not inspect, store,
        or ship the inventory ourselves.
      </p>

      <h2 className="mt-8 text-lg font-semibold text-slate-900">5. Payments, escrow &amp; commission</h2>
      <ul className="mt-2 list-disc space-y-1 pl-5">
        <li>Payments are processed by Stripe. By using paid features you also agree to Stripe&apos;s terms and, if you receive payouts, the Stripe Connected Account Agreement.</li>
        <li>When a buyer pays, funds are authorized and held until the buyer confirms receipt of the order, at which point they are captured and released to the seller, minus our commission.</li>
        <li>The commission percentage is disclosed in the app before checkout and may be changed for future orders; it does not change on an order already placed.</li>
        <li>If a dispute is raised, we may review the order and release the funds to either the buyer (refund) or the seller, based on the evidence provided by both sides.</li>
      </ul>

      <h2 className="mt-8 text-lg font-semibold text-slate-900">6. Reviews</h2>
      <p className="mt-2">
        Reviews must reflect a genuine completed transaction and may not
        contain false, defamatory, or abusive content. We may remove reviews
        that violate this.
      </p>

      <h2 className="mt-8 text-lg font-semibold text-slate-900">7. Suspension &amp; termination</h2>
      <p className="mt-2">
        We may suspend or terminate an account for violation of these Terms,
        fraud, non-payment, or legal requirements. You may close your
        account at any time from Dashboard → Account.
      </p>

      <h2 className="mt-8 text-lg font-semibold text-slate-900">8. Disclaimers &amp; limitation of liability</h2>
      <p className="mt-2">
        The Service is provided &ldquo;as is&rdquo;. We do not guarantee the
        quality, safety, legality, or accuracy of listings, or that any
        offer will be accepted. To the maximum extent permitted by law, we
        are not liable for indirect, incidental, or consequential damages
        arising from your use of the Service or from transactions between
        businesses.
      </p>

      <h2 className="mt-8 text-lg font-semibold text-slate-900">9. Changes</h2>
      <p className="mt-2">
        We may update these Terms from time to time. Continued use of the
        Service after a change constitutes acceptance of the updated Terms.
      </p>

      <h2 className="mt-8 text-lg font-semibold text-slate-900">10. Governing law</h2>
      <p className="mt-2">[GOVERNING LAW / JURISDICTION].</p>

      <h2 className="mt-8 text-lg font-semibold text-slate-900">11. Contact</h2>
      <p className="mt-2">
        [LEGAL ENTITY NAME], [ADDRESS] —{" "}
        <a href="mailto:[SUPPORT_EMAIL]" className="text-indigo-600 hover:underline">
          [SUPPORT_EMAIL]
        </a>
      </p>
    </div>
  );
}
