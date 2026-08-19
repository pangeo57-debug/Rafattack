import Link from "next/link";
import { requireBusiness } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { ui, badgeColor } from "@/lib/ui";

export default async function DashboardPage() {
  const { business } = await requireBusiness();

  const [listingCount, pendingOffersReceived, openOrders, reviewAgg] = await Promise.all([
    prisma.listing.count({ where: { sellerBusinessId: business.id, status: "ACTIVE" } }),
    prisma.offer.count({
      where: { listing: { sellerBusinessId: business.id }, status: "PENDING" },
    }),
    prisma.transaction.count({
      where: {
        OR: [{ sellerBusinessId: business.id }, { buyerBusinessId: business.id }],
        orderStatus: { notIn: ["COMPLETED", "CANCELLED"] },
      },
    }),
    prisma.review.aggregate({
      where: { revieweeBusinessId: business.id },
      _avg: { rating: true },
      _count: true,
    }),
  ]);

  return (
    <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">{business.name}</h1>
          <div className="mt-1 flex items-center gap-2">
            <span className={`${ui.badge} ${badgeColor(business.verificationStatus)}`}>
              {business.verificationStatus}
            </span>
            <span className="text-sm text-slate-500">
              {business.city}, {business.country}
            </span>
            {reviewAgg._count > 0 && (
              <span className="text-sm text-slate-500">
                &middot; {reviewAgg._avg.rating?.toFixed(1)} ★ ({reviewAgg._count} reviews)
              </span>
            )}
          </div>
        </div>
        <Link href="/dashboard/business" className={ui.btnSecondary}>
          Edit business profile
        </Link>
      </div>

      {!business.stripeOnboarded && (
        <div className="mt-6 rounded-md border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          Connect your Stripe account to receive payouts when you sell.{" "}
          <Link href="/dashboard/business" className="font-medium underline">
            Set up payouts
          </Link>
        </div>
      )}

      <div className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Active listings" value={listingCount} href="/dashboard/listings" />
        <StatCard label="Pending offers received" value={pendingOffersReceived} href="/dashboard/offers" />
        <StatCard label="Open orders" value={openOrders} href="/dashboard/orders" />
        <StatCard
          label="Rating"
          value={reviewAgg._count > 0 ? `${reviewAgg._avg.rating?.toFixed(1)} ★` : "—"}
          href="/dashboard/orders"
        />
      </div>

      <div className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-3">
        <QuickLink href="/listings/new" title="List inventory" desc="Post excess stock for sale." />
        <QuickLink href="/listings" title="Browse marketplace" desc="Find discounted bulk inventory to buy." />
        <QuickLink href="/dashboard/saved-searches" title="Saved searches" desc="Get notified about matching listings." />
      </div>
    </div>
  );
}

function StatCard({ label, value, href }: { label: string; value: number | string; href: string }) {
  return (
    <Link href={href} className={`${ui.card} block p-4 hover:border-indigo-300`}>
      <p className="text-sm text-slate-500">{label}</p>
      <p className="mt-1 text-2xl font-semibold text-slate-900">{value}</p>
    </Link>
  );
}

function QuickLink({ href, title, desc }: { href: string; title: string; desc: string }) {
  return (
    <Link href={href} className={`${ui.card} block p-4 hover:border-indigo-300`}>
      <p className="font-medium text-slate-900">{title}</p>
      <p className="mt-1 text-sm text-slate-500">{desc}</p>
    </Link>
  );
}
