import { prisma } from "@/lib/prisma";
import { sessionState } from "./session-state";

export async function resetDb() {
  const tables = await prisma.$queryRaw<{ tablename: string }[]>`
    SELECT tablename FROM pg_tables WHERE schemaname = 'public' AND tablename <> '_prisma_migrations'`;
  if (tables.length === 0) return;
  const list = tables.map((t) => `"public"."${t.tablename}"`).join(", ");
  await prisma.$executeRawUnsafe(`TRUNCATE TABLE ${list} RESTART IDENTITY CASCADE`);
}

let n = 0;

export async function makeBusiness(opts: { verified?: boolean; stripe?: boolean } = {}) {
  n++;
  const business = await prisma.business.create({
    data: {
      name: `Biz ${n}`,
      type: "RETAILER",
      category: "Apparel & Footwear",
      country: "Greece",
      city: "Athens",
      taxId: `EL${n}`,
      contactEmail: `biz${n}@test.local`,
      verificationStatus: opts.verified === false ? "PENDING" : "VERIFIED",
      stripeAccountId: opts.stripe === false ? null : `acct_seed_${n}`,
      stripeOnboarded: opts.stripe !== false,
    },
  });
  const user = await prisma.user.create({
    data: {
      email: `user${n}@test.local`,
      name: `User ${n}`,
      passwordHash: "x",
      businessId: business.id,
      emailVerified: new Date(),
    },
  });
  return { business, user };
}

export function actAs(who: { user: { id: string; businessId: string | null; platformRole?: string } } | null) {
  sessionState.user = who
    ? { id: who.user.id, businessId: who.user.businessId, platformRole: who.user.platformRole ?? "USER" }
    : null;
}

export async function makeListing(sellerBusinessId: string, overrides: Record<string, unknown> = {}) {
  return prisma.listing.create({
    data: {
      sellerBusinessId,
      title: "Winter jackets",
      description: "Mixed sizes, tags attached.",
      category: "Apparel & Footwear",
      quantityAvailable: 100,
      originalPrice: 65,
      askingPrice: 18,
      minOrderQty: 1,
      locationCity: "Athens",
      locationCountry: "Greece",
      ...overrides,
    },
  });
}

// Route handlers take NextRequest and typed params; tests pass a plain Request
// augmented with the NextRequest fields our handlers read.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Handler = (req: any, ctx: any) => Promise<Response>;

/** Invoke a route handler exactly as Next.js would, returning status + parsed JSON. */
export async function call(
  handler: Handler,
  opts: { method?: string; body?: unknown; params?: Record<string, string>; headers?: Record<string, string>; rawBody?: string } = {}
) {
  const req = new Request("http://localhost:3000/api/test", {
    method: opts.method ?? "POST",
    headers: { "content-type": "application/json", ...(opts.headers ?? {}) },
    body: opts.rawBody ?? (opts.body === undefined ? undefined : JSON.stringify(opts.body)),
  });
  // NextRequest-only fields used by our handlers.
  Object.assign(req, { nextUrl: new URL(req.url) });
  const res = await handler(req, { params: Promise.resolve(opts.params ?? {}) });
  const text = await res.text();
  let json: unknown = null;
  try {
    json = JSON.parse(text);
  } catch {
    json = text;
  }
  return { status: res.status, json: json as Record<string, unknown> };
}
