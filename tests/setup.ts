import { vi, beforeEach } from "vitest";
import { resetFakeStripe } from "./fake-stripe";
import { resetDb } from "./helpers";
import { sessionState } from "./session-state";

// vi.mock factories are hoisted above imports, so they load their
// dependencies lazily instead of closing over the imports above.
vi.mock("@/auth", async () => {
  const { sessionState } = await import("./session-state");
  return { auth: async () => (sessionState.user ? { user: sessionState.user } : null) };
});

vi.mock("@/lib/stripe", async () => {
  const { fakeStripe } = await import("./fake-stripe");
  return { stripe: fakeStripe, requireStripe: () => fakeStripe };
});

vi.mock("@/lib/email", async (orig) => ({
  ...(await orig<typeof import("@/lib/email")>()),
  sendEmail: async () => ({ devFallback: true }),
}));

beforeEach(async () => {
  sessionState.user = null;
  resetFakeStripe();
  await resetDb();
});
