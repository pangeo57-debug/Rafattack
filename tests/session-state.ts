// Who the route handlers think is logged in. Tests set this via actAs().
export const sessionState: { user: null | { id: string; businessId: string | null; platformRole: string } } = {
  user: null,
};
