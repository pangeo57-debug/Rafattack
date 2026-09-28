// A stand-in for the Stripe SDK that behaves like real Stripe in the ways
// our money logic depends on: every call is recorded, and a repeated
// idempotency key returns the original object instead of doing the work
// again (that is Stripe's documented behaviour, and what our duplicate-
// charge protection relies on).

type Opts = { idempotencyKey?: string } | undefined;
type Session = { id: string; url: string; status: "open" | "complete" | "expired"; payment_intent: string; metadata: Record<string, string> };

let counter = 0;
const byKey = new Map<string, unknown>();

export const calls = {
  sessionsCreated: [] as Session[],
  sessionsExpired: [] as string[],
  transfers: [] as { amount: number; destination: string; idempotencyKey?: string }[],
  refunds: [] as { payment_intent: string; idempotencyKey?: string }[],
};
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
}

/** Simulate the buyer finishing payment on Stripe's hosted page. */
export function completeSession(id: string) {
  const s = sessions.get(id);
  if (!s) throw new Error(`no fake session ${id}`);
  s.status = "complete";
  return s;
}

export const fakeStripe = {
  checkout: {
    sessions: {
      create: async (params: { metadata?: Record<string, string> }, opts?: Opts) =>
        idempotent(opts, () => {
          counter++;
          const s: Session = {
            id: `cs_test_${counter}`,
            url: `https://checkout.stripe.test/cs_test_${counter}`,
            status: "open",
            payment_intent: `pi_test_${counter}`,
            metadata: params.metadata ?? {},
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
        if (s && s.status === "open") s.status = "expired";
        calls.sessionsExpired.push(id);
        return s;
      },
    },
  },
  transfers: {
    create: async (p: { amount: number; destination: string }, opts?: Opts) =>
      idempotent(opts, () => {
        calls.transfers.push({ amount: p.amount, destination: p.destination, idempotencyKey: opts?.idempotencyKey });
        return { id: `tr_test_${++counter}` };
      }),
  },
  refunds: {
    create: async (p: { payment_intent: string }, opts?: Opts) =>
      idempotent(opts, () => {
        calls.refunds.push({ payment_intent: p.payment_intent, idempotencyKey: opts?.idempotencyKey });
        return { id: `re_test_${++counter}` };
      }),
  },
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
