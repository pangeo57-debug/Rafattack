import { AsyncLocalStorage } from "node:async_hooks";
// Who the route handlers think is logged in. Tests set this via actAs().
export const sessionState: { user: null | { id: string; businessId: string | null; platformRole: string } } = {
  user: null,
};

/** Every email the app tried to send during the current test. */
export const sentEmails: { to: string; subject: string; html: string }[] = [];

type SessionUser = { id: string; businessId: string | null; platformRole: string };

/** Per-request user, for tests that fire several users' requests at once. */
export const requestUser = new AsyncLocalStorage<SessionUser | null>();

export function currentUser(): SessionUser | null {
  const scoped = requestUser.getStore();
  return scoped !== undefined ? scoped : sessionState.user;
}
