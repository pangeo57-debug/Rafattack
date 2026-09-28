// A stand-in for the Stripe SDK that behaves like real Stripe in the ways
// our money logic depends on: every call is recorded, and a repeated
// idempotency key returns the original object instead of doing the work
// again (that is Stripe's documented behaviour, and what our duplicate-
// charge protection relies on).

type Opts = { idempotencyKey?: string } | undefined;
type Session = { id: string; url: string; status: "open" | "complete" | "expired"; payment_intent: string; metadata: Record<string, string>; amount_total?: number };

let counter = 0;
const byKey = new Map<string, unknown>();

export const calls = {
  sessionsCreated: [] as Session[],
  sessionsExpired: [] as string[],
  transfers: [] as { id: string; amount: number; destination: string; transfer_group?: string; metadata?: Record<string, string>; idempotencyKey?: string }[],
  refunds: [] as { id: string; payment_intent: string; metadata?: Record<string, string>; idempotencyKey?: string }[],
};

/**
 * Simulate Stripe trouble. "fail": the call throws and nothing happens.
 * "lostResponse": Stripe does the work but the reply never reaches us (a
 * network timeout), so our side sees an error. Each entry is used once.
 */
export const outages = { transfers: [] as ("fail" | "lostResponse")[], refunds: [] as ("fail" | "lostResponse")[] };
const sessions = new Map<string, Session>();

function idempotent<T>(opts: Opts, make: () => T): T {
  if (opts?.idempotencyKey && byKey.has(opts.idempotencyKey)) return byKey.get(opts.idempotencyKey) as T;
  const result = make();
  if (opts?.idempotencyKey) byKey.set(opts.idempotencyKey, result);
  return result;
}

export function resetFakeStripe() {
  counter = 0;
  byKey.clear();
  sessions.clear();
  calls.sessionsCreated.length = 0;
  calls.sessionsExpired.length = 0;
  calls.transfers.length = 0;
  calls.refunds.length = 0;
  outages.transfers.length = 0;
  outages.refunds.length = 0;
}

/** Simulate the buyer finishing payment on Stripe's hosted page (the
 * payment itself may still be processing, as with SEPA). */
export function completeSession(id: string) {
  const s = sessions.get(id);
  if (!s) throw new Error(`no fake session ${id}`);
  s.status = "complete";
  return s;
}

export const fakeStripe = {
  checkout: {
    sessions: {
      create: async (
        params: { metadata?: Record<string, string>; line_items?: { price_data: { unit_amount: number }; quantity: number }[] },
        opts?: Opts
      ) =>
        idempotent(opts, () => {
          counter++;
          const s: Session = {
            id: `cs_test_${counter}`,
            url: `https://checkout.stripe.test/cs_test_${counter}`,
            status: "open",
            payment_intent: `pi_test_${counter}`,
            metadata: params.metadata ?? {},
            // What Stripe would charge: sum of unit_amount x quantity, integers only.
            amount_total: (params.line_items ?? []).reduce((sum, li) => sum + li.price_data.unit_amount * li.quantity, 0),
          };
          sessions.set(s.id, s);
          calls.sessionsCreated.push(s);
          return s;
        }),
      retrieve: async (id: string) => {
        const s = sessions.get(id);
        if (!s) throw new Error(`No such checkout.session: ${id}`);
        return s;
      },
      expire: async (id: string) => {
        const s = sessions.get(id);
        // Real Stripe refuses to expire a session that isn't open.
        if (!s || s.status !== "open") throw new Error("Only Checkout Sessions with a status in [open] can be expired.");
        s.status = "expired";
        calls.sessionsExpired.push(id);
        return s;
      },
    },
  },
  transfers: {
    create: async (
      p: { amount: number; destination: string; transfer_group?: string; metadata?: Record<string, string> },
      opts?: Opts
    ) => {
      const outage = outages.transfers.shift();
      if (outage === "fail") throw new Error("Stripe API unavailable (simulated)");
      const result = idempotent(opts, () => {
        const t = { id: `tr_test_${++counter}`, amount: p.amount, destination: p.destination, transfer_group: p.transfer_group, metadata: p.metadata, idempotencyKey: opts?.idempotencyKey };
        calls.transfers.push(t);
        return { id: t.id };
      });
      if (outage === "lostResponse") throw new Error("Request timed out (simulated)");
      return result;
    },
    list: async (q: { transfer_group?: string }) => ({
      data: calls.transfers.filter((t) => !q.transfer_group || t.transfer_group === q.transfer_group),
    }),
  },
  refunds: {
    create: async (p: { payment_intent: string; metadata?: Record<string, string> }, opts?: Opts) => {
      const outage = outages.refunds.shift();
      if (outage === "fail") throw new Error("Stripe API unavailable (simulated)");
      const result = idempotent(opts, () => {
        const r = { id: `re_test_${++counter}`, payment_intent: p.payment_intent, metadata: p.metadata, idempotencyKey: opts?.idempotencyKey };
        calls.refunds.push(r);
        return { id: r.id };
      });
      if (outage === "lostResponse") throw new Error("Request timed out (simulated)");
      return result;
    },
    list: async (q: { payment_intent?: string }) => ({
      data: calls.refunds.filter((r) => !q.payment_intent || r.payment_intent === q.payment_intent),
    }),
  },
  /** Stripe forgets idempotency keys after 24 hours; tests can make that happen now. */
  _forgetIdempotencyKeys: () => byKey.clear(),
  accounts: {
    create: async () => ({ id: `acct_test_${++counter}` }),
    retrieve: async (id: string) => ({ id, details_submitted: true, charges_enabled: true }),
  },
  accountLinks: { create: async () => ({ url: "https://connect.stripe.test/onboard" }) },
  webhooks: {
    constructEvent: (body: string, signature: string) => {
      if (signature !== "valid-test-signature") throw new Error("No signatures found matching the expected signature");
      return JSON.parse(body);
    },
  },
};
