# Overstock Trade

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
- [Prisma](https://www.prisma.io) ORM — SQLite for local dev, swap to
  Postgres/MySQL for production by changing the `provider` in
  `prisma/schema.prisma` and pointing `DATABASE_URL` at your database
- [Auth.js / NextAuth v5](https://authjs.dev) — email/password
  (credentials) auth, one account per business
- [Stripe Connect](https://stripe.com/connect) (Express accounts) for
  seller payouts, plus Stripe Checkout with **manual-capture** payment
  intents to hold funds in escrow until the buyer confirms receipt

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
- **Escrow-style payments** — accepting an offer creates an order. The
  buyer pays via Stripe Checkout with a manually-captured PaymentIntent
  (funds authorized, not yet transferred). The platform's commission is
  taken as a Stripe `application_fee_amount` and the remainder routed to
  the seller's connected account via `transfer_data` — both happen
  automatically the moment the PaymentIntent is captured, which happens
  when the buyer confirms receipt (or an admin resolves a dispute in the
  seller's favor).
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

```bash
npm install
cp .env.example .env        # then fill in AUTH_SECRET and Stripe keys
npx prisma migrate dev       # creates prisma/dev.db and applies the schema
npm run db:seed              # creates an admin account + demo seller/buyer
npm run dev
```

Seeded accounts (see `prisma/seed.ts`):

| Role   | Email                          | Password      |
| ------ | ------------------------------- | -------------- |
| Admin  | `admin@overstocktrade.test`    | `admin12345`  |
| Seller | `seller@overstocktrade.test`   | `seller12345` |
| Buyer  | `buyer@overstocktrade.test`    | `buyer12345`  |

The seed also creates one demo listing so `/listings` isn't empty.

### Environment variables

See `.env.example`. At minimum for local dev without payments you only
need `DATABASE_URL` and `AUTH_SECRET`. To exercise the checkout flow you
need a Stripe test-mode secret key, and a seller business that has
completed Stripe Connect onboarding (`/dashboard/business` → "Connect
Stripe"). To receive the `checkout.session.completed` webhook locally,
run:

```bash
stripe listen --forward-to localhost:3000/api/stripe/webhook
```

and put the printed `whsec_...` value in `STRIPE_WEBHOOK_SECRET`.

### Commission

The commission percentage is read from the `PlatformSetting` table
(seeded to 8%, editable at `/admin/settings`), falling back to the
`PLATFORM_COMMISSION_PERCENT` env var if no row exists yet. It's captured
onto each `Transaction` at the moment an offer is accepted, so changing it
only affects orders created afterward.

## Project structure

- `prisma/schema.prisma` — data model (Business, User, Listing, Offer,
  Transaction, Review, SavedSearch, Notification, PlatformSetting)
- `src/app` — pages and API routes (Next.js App Router)
- `src/components` — client components (forms, action buttons)
- `src/lib` — Prisma client, auth/session helpers, Stripe client,
  commission math, notifications, zod validators

## Known v1 limitations

- Photos are pasted image URLs, not uploaded files (no object storage
  wired up yet).
- No email delivery — notifications are in-app only.
- Buyer/seller negotiation supports one round of counter-offer.
- SQLite is fine for development; use Postgres in production for
  concurrent writes and case-insensitive search.
