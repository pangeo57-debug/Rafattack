import Link from "next/link";
import type { Metadata } from "next";
import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";
import { ui, formatDate } from "@/lib/ui";
import { formatCents } from "@/lib/money";
import { LISTING_CATEGORIES, LISTING_CONDITIONS } from "@/lib/constants";

export const metadata: Metadata = {
  title: "Wanted: what buyers are looking for — Surplo",
  description: "Verified businesses waiting to buy overstock. List matching stock and sell in one click.",
};

export default async function WantedPage({ searchParams }: { searchParams: Promise<{ category?: string }> }) {
  const { category } = await searchParams;
  const filter = category && LISTING_CATEGORIES.includes(category) ? category : undefined;
  const now = new Date();
  const where = {
    status: "ACTIVE" as const,
    expiresAt: { gt: now },
    buyerBusiness: { verificationStatus: "VERIFIED" as const, deletedAt: null },
    ...(filter ? { category: filter } : {}),
  };

  const [requests, [totals], session] = await Promise.all([
    prisma.buyOrder.findMany({
      where,
      // Buyers stay anonymous here: no name, no id, no link to their profile.
      select: {
        id: true, category: true, conditions: true, maxUnitPriceCents: true, currency: true,
        remainingQty: true, minLotQty: true, country: true, city: true, expiresAt: true,
      },
      orderBy: { createdAt: "desc" },
      take: 100,
    }),
    prisma.$queryRaw<{ count: bigint; cents: bigint | null }[]>`
      SELECT COUNT(*)::bigint AS count, SUM(b."remainingQty"::bigint * b."maxUnitPriceCents")::bigint AS cents
      FROM "BuyOrder" b JOIN "Business" z ON z.id = b."buyerBusinessId"
      WHERE b.status = 'ACTIVE' AND b."expiresAt" > ${now} AND z."verificationStatus" = 'VERIFIED' AND z."deletedAt" IS NULL
        AND (${filter ?? null}::text IS NULL OR b.category = ${filter ?? null})`,
    auth(),
  ]);
  const demandCents = Number(totals?.cents ?? 0);

  return (
    <div className="mx-auto max-w-5xl px-4 py-10 sm:px-6">
      <h1 className="text-2xl font-semibold text-zinc-900">Wanted</h1>
      <p className="mt-1 max-w-2xl text-zinc-600">
        Verified businesses waiting to buy. If you have matching stock, list it: these buyers appear on your listing and
        you can sell to them in one click, at their price, with payment held in escrow.
      </p>

      <div className="mt-6 grid grid-cols-2 gap-3 sm:max-w-md">
        <div className={`${ui.card} p-4`}>
          <p className="text-xs uppercase tracking-wide text-zinc-400">Open requests</p>
          <p className="mt-1 text-2xl font-semibold text-zinc-900">{Number(totals?.count ?? 0)}</p>
        </div>
        <div className={`${ui.card} p-4`}>
          <p className="text-xs uppercase tracking-wide text-zinc-400">Demand waiting</p>
          <p className="mt-1 text-2xl font-semibold text-zinc-900">{formatCents(demandCents)}</p>
        </div>
      </div>

      <div className="mt-6 flex flex-wrap gap-2 text-sm">
        <Link href="/wanted" className={`${ui.badge} ${!filter ? "bg-zinc-900 text-white" : "bg-white text-zinc-600 ring-zinc-200"}`}>All</Link>
        {LISTING_CATEGORIES.map((c) => (
          <Link
            key={c}
            href={`/wanted?category=${encodeURIComponent(c)}`}
            className={`${ui.badge} ${filter === c ? "bg-zinc-900 text-white" : "bg-white text-zinc-600 ring-zinc-200"}`}
          >
            {c}
          </Link>
        ))}
      </div>

      <div className="mt-6 flex flex-wrap gap-2">
        <Link href={session?.user ? "/listings/new" : "/signup"} className={ui.btnPrimary}>I have this stock: list it</Link>
        <Link href={session?.user ? "/dashboard/bids" : "/signup"} className={ui.btnSecondary}>Post what I want to buy</Link>
      </div>

      <div className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {requests.length === 0 && <p className="text-zinc-500">No open requests{filter ? " in this category" : ""} yet.</p>}
        {requests.map((r) => (
          <div key={r.id} className={`${ui.card} p-4`}>
            <p className="text-xs font-medium uppercase tracking-wide text-brand">{r.category}</p>
            <p className="mt-1 text-lg font-semibold text-zinc-900">
              up to {formatCents(r.maxUnitPriceCents, r.currency)}
              <span className="text-sm font-normal text-zinc-500"> / unit</span>
            </p>
            <p className="mt-1 text-sm text-zinc-600">
              {r.remainingQty} units wanted · lots of {r.minLotQty}+
            </p>
            <p className="mt-1 text-sm text-zinc-500">
              {r.conditions.map((c) => LISTING_CONDITIONS.find((x) => x.value === c)?.label ?? c).join(", ")}
            </p>
            <p className="mt-1 text-sm text-zinc-500">
              {r.city ? `${r.city}, ${r.country}` : `Anywhere in ${r.country}`} · open until {formatDate(r.expiresAt)}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}
