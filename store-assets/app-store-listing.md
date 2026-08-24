# App Store Connect listing draft

Draft copy for the App Store Connect submission form. Everything in
`[BRACKETS]` needs a real value from you before submitting.

## App information

- **Name** (30 char max): `Overstock Trade`
- **Subtitle** (30 char max): `B2B Overstock Marketplace`
- **Bundle ID**: `com.overstocktrade.app` (set in `capacitor.config.ts` — change
  it if you want a different reverse-domain ID, then re-run `npx cap sync ios`)
- **Primary category**: Business
- **Secondary category**: Shopping
- **Age rating**: 4+ (no objectionable content; it's a B2B trading app)

## Promotional text (170 chars, editable without a new review)

> List excess inventory, get offers from verified resellers and outlets,
> and get paid safely with escrow-protected payments.

## Description (4000 char max)

> Overstock Trade is the marketplace where retail businesses turn excess
> and overstock inventory into cash — and where resellers, outlet stores,
> and liquidators find discounted bulk inventory to buy.
>
> **For sellers**
> List your overstock, past-season, or returned inventory in minutes.
> Set your asking price, minimum order quantity, and whether buyers can
> pick up or you'll ship. Accept offers instantly or negotiate a
> counter-offer.
>
> **For buyers**
> Browse active listings by category, location, price, and quantity.
> Buy at the listed price or send an offer. Every seller has a public
> profile with reviews from past buyers, so you know who you're dealing
> with.
>
> **Escrow-protected payments**
> When a sale is agreed, payment is collected securely and held until you
> confirm the order arrived as described — then it's released to the
> seller automatically, minus a small platform commission. No more
> chasing invoices or wiring money on trust.
>
> **Built for business**
> Every account represents a verified business — sign up with your
> company details and tax/VAT ID. Track every offer and order from a
> single dashboard, get notified the moment something needs your
> attention, and build a reputation through reviews on completed deals.

## Keywords (100 char max, comma-separated)

```
b2b,wholesale,liquidation,overstock,marketplace,resell,inventory,closeout,bulk,outlet
```

## URLs

- **Support URL**: `[https://yourdomain.com/support or a contact page]`
- **Marketing URL** (optional): `[https://yourdomain.com]`
- **Privacy Policy URL** (required): `[https://yourdomain.com/privacy]`
  — already built at `/privacy` in the app, just needs your production
  domain and the `[BRACKETS]` in that page filled in with your legal
  entity name/address/support email.

## App Privacy ("nutrition label") — draft answers

Apple asks what data *your app* collects. Suggested answers based on what
this codebase actually stores (double-check against Apple's current
categories in App Store Connect, they get renamed occasionally):

| Data type | Collected? | Linked to user? | Used for tracking? | Purpose |
|---|---|---|---|---|
| Name | Yes | Yes | No | App functionality (account/business identity) |
| Email Address | Yes | Yes | No | App functionality (login) |
| Phone Number | Yes (optional field) | Yes | No | App functionality (business contact) |
| Physical Address | Yes (business address) | Yes | No | App functionality |
| User ID | Yes | Yes | No | App functionality |
| Purchase History | Yes (orders/transactions) | Yes | No | App functionality |
| Other Financial Info | No (Stripe handles card/bank data directly, not us) | — | — | — |
| Photos or Videos | Only if you add photo upload later — currently listing photos are pasted URLs, not uploaded through the app | — | — | — |

Declare **no data used for tracking** (no ad networks/trackers in this
codebase) and **no data sold**.

## App Review notes (paste into the "Notes" box on submission)

> Overstock Trade is a B2B marketplace. Demo accounts for review:
>
> Admin: admin@overstocktrade.test / admin12345
> Seller: seller@overstocktrade.test / seller12345 (has one active listing)
> Buyer: buyer@overstocktrade.test / buyer12345
>
> Suggested test flow: log in as buyer -> Browse -> open the seller's
> listing -> "Send offer" -> log in as seller -> Dashboard -> Offers ->
> Accept -> an order is created.
>
> Note: completing a real payment requires the seller to finish Stripe
> Connect onboarding (Dashboard -> Business -> Connect Stripe), which
> needs a real/test Stripe account and can't be pre-filled for you. If
> you'd like us to walk through the paid checkout specifically, let us
> know and we'll enable Stripe test mode with test card details ahead of
> your review.
>
> Payments for physical inventory are processed via Stripe Connect
> (external payment processor), not Apple In-App Purchase, per guideline
> 3.1.5(a)/"Goods and Services Outside the App" — this is a marketplace
> for real, physical business inventory, not digital content.
>
> Account deletion: Dashboard -> Account -> Delete account.

## Screenshots

You'll need screenshots for at least the 6.9" (iPhone 16 Pro Max class)
size; 6.5" is also commonly required. Easiest way once it's deployed:
open the live site on an iPhone-sized viewport (Safari responsive mode or
an actual/simulated device) and capture: **Browse listings**, **Listing
detail**, **Dashboard**, **Order/escrow status**, **Admin dashboard**
(optional, shows depth). Ask us if you want these generated once the app
is live at its real URL.
