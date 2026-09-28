// Who the route handlers think is logged in. Tests set this via actAs().
export const sessionState: { user: null | { id: string; businessId: string | null; platformRole: string } } = {
  user: null,
};

/** Every email the app tried to send during the current test. */
export const sentEmails: { to: string; subject: string; html: string }[] = [];
