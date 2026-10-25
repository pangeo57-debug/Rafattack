import Stripe from "stripe";

const key = process.env.STRIPE_SECRET_KEY;

// Allow the app to boot without Stripe configured (e.g. first local run);
// any route that actually calls Stripe will throw a clear error instead.
export const stripe = key
  ? new Stripe(key, { apiVersion: "2026-07-29.dahlia" })
  : (null as unknown as Stripe);

export function requireStripe(): Stripe {
  if (!stripe) {
    throw new Error(
      "Stripe is not configured. Set STRIPE_SECRET_KEY in your environment."
    );
  }
  return stripe;
}
