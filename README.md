# Surplo

A B2B marketplace where small and medium retail businesses sell excess and
overstock inventory directly to other businesses — resellers, outlet
stores, liquidators, other retailers — for real, cash-based payment.
The platform takes a configurable percentage commission on every
completed sale.

This is a v1 focused on the core loop: **sign up → list inventory → browse
& offer → pay into escrow → confirm receipt → payout & review.** Shipping
logistics are out of scope; fulfillment is pickup or manually-arranged
shipping between the two businesses.

## Stack

- [Next.js](https://nextjs.org) (App Router) + TypeScript
- Tailwind CSS
- [Prisma](https://www.prisma.io) ORM on Postgres
- [Auth.js / NextAuth v5](https://authjs.dev) — email/password
  (credentials) auth, one account per business
- [Stripe Connect](https://stripe.com/connect) (Express accounts) for
  seller payouts, plus Stripe Checkout (card/Apple Pay/Google Pay, PayPal,
  SEPA bank transfer) with a **separate-charges-and-transfers** escrow
  model — money lands in the platform's own Stripe balance first, and is
  only transferred to the seller once the buyer confirms receipt

## Core features

- **Business signup & verification** — company name, type (retailer,
  reseller, outlet, liquidator, wholesaler), category, location, tax/VAT
  ID, contact info. New businesses start `PENDING` until an admin verifies
  them.
- **Inventory listings** — title, description, category, photos (URLs),
  quantity, unit of sale (per item / per lot), condition, original vs.
  asking price, minimum order quantity, pickup/shipping/both, expiry date.
- **Browse & search** — filter by keyword, category, location, price
  range, quantity, and seller business type.
- **Offers & negotiation** — buy now at the asking price, or send an
  offer; the seller can accept, reject, or counter; the buyer can accept
  or reject a counter, or withdraw a pending offer.
- **Escrow-style payments, multiple payment methods** — accepting an offer
  creates an order. The buyer pays via Stripe Checkout, choosing card
  (Apple Pay/Google Pay work automatically), PayPal, or a SEPA bank
  transfer from an IBAN. Unlike a Connect destination charge, the payment
  is *not* split at checkout — it settles into the platform's own Stripe
  balance, which is what lets asynchronous methods like SEPA (which can
  take up to ~14 business days just to confirm) participate in escrow the
  same way an instant card payment does. The seller's share is only paid
  out via a separate Stripe Transfer once the buyer confirms receipt (or
  an admin resolves a dispute in the seller's favor); the platform's
  commission is simply the difference never transferred out.
- **Order tracking** — `AWAITING_PAYMENT → PAID → SHIPPED/PICKED_UP →
  COMPLETED`, with a full history per business and admin visibility into
  every transaction.
- **Trust & reviews** — after an order completes, either side can leave a
  1–5 star rating and comment, shown on the other business's public
  profile.
- **Notifications** — in-app notifications for saved-search matches,
  offers received/updated, payments received, and order status changes.
- **Admin dashboard** — GMV and commission revenue, all transactions,
  business verification (verify/reject/suspend), a dispute queue that can
  release funds to the seller or refund the buyer, and a configurable
  commission percentage.

## Getting started

You need a Postgres database (a free [Neon](https://neon.tech) or
[Supabase](https://supabase.com) project works fine, or a local Postgres
instance).

```bash
npm install
cp .env.example .env        # fill in DATABASE_URL, AUTH_SECRET, Stripe keys
npx prisma migrate dev       # applies the schema to your database
npm run db:seed              # creates an admin account + demo seller/buyer
npm run dev
```

Seeded accounts (see `prisma/seed.ts`):

| Role   | Email                          | Password      |
| ------ | ------------------------------- | -------------- |
| Admin  | `admin@surplo.test`    | `admin12345`  |
| Seller | `seller@surplo.test`   | `seller12345` |
| Buyer  | `buyer@surplo.test`    | `buyer12345`  |

The seed also creates one demo listing so `/listings` isn't empty.

## Deploying to Vercel

1. [vercel.com/new](https://vercel.com/new) → import this repo (branch
   `claude/overstock-trade-marketplace-a56vt4`, or `main` once merged).
2. Before deploying, open the project's **Storage** tab → **Create Database
   → Postgres** (Neon-backed). This sets `DATABASE_URL` for you.
3. Add the remaining environment variables (`AUTH_SECRET`,
   `NEXT_PUBLIC_APP_URL` set to your deployment URL, and Stripe keys if you
   want payments to work).
4. Deploy. The build command (`prisma generate && prisma migrate deploy &&
   next build`) applies the schema to your new database automatically —
   run `npm run db:seed` once locally against that same `DATABASE_URL` if
   you want the demo accounts on the live site too.

### Environment variables

See `.env.example`. At minimum for local dev without payments you only
need `DATABASE_URL` and `AUTH_SECRET`. To exercise the checkout flow you
need a Stripe test-mode secret key, PayPal and SEPA Direct Debit enabled
on that Stripe account (Dashboard → Settings → Payment methods), and a
seller business that has completed Stripe Connect onboarding
(`/dashboard/business` → "Connect Stripe"). To receive webhooks locally,
run:

```bash
stripe listen --forward-to localhost:3000/api/stripe/webhook
```

and put the printed `whsec_...` value in `STRIPE_WEBHOOK_SECRET`. The app
listens for `checkout.session.completed`, `checkout.session.async_payment_succeeded`,
and `checkout.session.async_payment_failed` — add all three to the
webhook endpoint in the Stripe Dashboard for production.

### Account security

- **Email verification** — signup sends a verification link (24h expiry).
  Unverified accounts can still use the app (a dashboard banner nags them
  to verify / resend), matching common practice rather than hard-blocking.
- **Password reset** — `/forgot-password` → emailed link (1h expiry) →
  `/reset-password`. The forgot-password endpoint always responds the same
  way whether or not the email is registered, so it can't be used to check
  which emails have accounts.
- **Login lockout** — 5 failed password attempts locks that account for 15
  minutes (tracked on the `User` row, not per-IP, so it can't be dodged by
  changing networks).
- **Rate limiting** — signup and password-reset requests are throttled by
  IP (and email, for reset requests) using a small Postgres-backed fixed
  window limiter (`RateLimitAttempt` table) — no Redis/external service
  needed.

Without `RESEND_API_KEY` set, verification/reset emails are logged to the
server console instead of sent — enough to test the flow locally, but set
a real key before going to production or nobody can actually verify or
reset their password.

### Commission

The commission percentage is read from the `PlatformSetting` table
(seeded to 8%, editable at `/admin/settings`), falling back to the
`PLATFORM_COMMISSION_PERCENT` env var if no row exists yet. It's captured
onto each `Transaction` at the moment an offer is accepted, so changing it
only affects orders created afterward.

## Shipping the iOS app (App Store)

The app is wrapped as a native iOS shell with [Capacitor](https://capacitorjs.com),
loading the deployed site (`server.url` in `capacitor.config.ts`) inside a
real native app rather than bundling a static export — needed since this
app has server-side API routes, auth, and a database.

What's already done in this repo:

- `capacitor.config.ts` + `ios/` Xcode project (App name, bundle ID
  `com.surplo.app`, brand-colored status bar & splash screen)
- App icon and splash screen assets (`resources/icon.png`,
  `resources/splash.png` → regenerate all sizes with
  `npx capacitor-assets generate --ios` after changing them)
- Privacy Policy, Terms of Service, in-app account deletion (Apple
  Guideline 5.1.1v) — see `/privacy`, `/terms`, `/dashboard/account`
- `store-assets/app-store-listing.md` — draft App Store Connect copy
  (description, keywords, category, App Privacy answers, review notes)

What you need to do (requires a Mac, or a cloud build service if you
don't have one — e.g. [Codemagic](https://codemagic.io) or
[Ionic Appflow](https://ionic.io/appflow) can build/sign an iOS app from
this repo without a physical Mac):

1. Deploy the app (see "Deploying to Vercel" above) and get its
   production URL.
2. Update `server.url` in `capacitor.config.ts` to that URL, and
   `NEXT_PUBLIC_APP_URL` in your Vercel env vars to match.
3. `npx cap sync ios`
4. Enroll in the [Apple Developer Program](https://developer.apple.com/programs/) ($99/yr) if you haven't.
5. `npx cap open ios` (opens Xcode) → set your Team under Signing &
   Capabilities → Product → Archive → distribute to App Store Connect.
   (Or point a cloud CI service at this repo if you don't have Xcode.)
6. Create the app listing in [App Store Connect](https://appstoreconnect.apple.com)
   using `store-assets/app-store-listing.md` as your starting copy, fill
   in the Privacy Policy URL, upload screenshots, and submit for review —
   the App Review notes in that file include working demo credentials.

Fill in the `[BRACKETS]` in `/privacy` and `/terms` (legal entity name,
address, support email, governing law) before submitting — Apple checks
that these are real, not placeholders.

## Project structure

- `prisma/schema.prisma` — data model (Business, User, Listing, Offer,
  Transaction, Review, SavedSearch, Notification, PlatformSetting,
  VerificationToken, RateLimitAttempt)
- `src/app` — pages and API routes (Next.js App Router)
- `src/components` — client components (forms, action buttons)
- `src/lib` — Prisma client, auth/session helpers, Stripe client,
  commission math, notifications, zod validators

## Known v1 limitations

- Photos are pasted image URLs, not uploaded files (no object storage
  wired up yet).
- Only account emails (verify/reset) are sent — offer/payment/order
  notifications are in-app only, no email digest yet.
- Buyer/seller negotiation supports one round of counter-offer.
