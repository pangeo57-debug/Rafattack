import { vi, beforeEach } from "vitest";
import { resetFakeStripe } from "./fake-stripe";
import { resetDb } from "./helpers";
import { sessionState, sentEmails } from "./session-state";

// vi.mock factories are hoisted above imports, so they load their
// dependencies lazily instead of closing over the imports above.
vi.mock("@/auth", async () => {
  const { currentUser } = await import("./session-state");
  return {
    auth: async () => {
      const user = currentUser();
      return user ? { user } : null;
    },
  };
});

vi.mock("@/lib/stripe", async () => {
  const { fakeStripe } = await import("./fake-stripe");
  return { stripe: fakeStripe, requireStripe: () => fakeStripe };
});

vi.mock("@/lib/email", async (orig) => {
  const { sentEmails } = await import("./session-state");
  return {
    ...(await orig<typeof import("@/lib/email")>()),
    sendEmail: async (to: string, subject: string, html: string) => {
      sentEmails.push({ to, subject, html });
      return { devFallback: true };
    },
  };
});

beforeEach(async () => {
  sessionState.user = null;
  sentEmails.length = 0;
  resetFakeStripe();
  await resetDb();
});
