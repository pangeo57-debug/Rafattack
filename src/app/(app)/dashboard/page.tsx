import Link from "next/link";
import { Package, Handshake, ShoppingBag, Star, PackagePlus, Search, Bookmark, ArrowRight } from "lucide-react";
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
          <h1 className="text-2xl font-semibold text-zinc-900">{business.name}</h1>
          <div className="mt-1 flex items-center gap-2">
            <span className={`${ui.badge} ${badgeColor(business.verificationStatus)}`}>
              {business.verificationStatus}
            </span>
            <span className="text-sm text-zinc-500">
              {business.city}, {business.country}
            </span>
            {reviewAgg._count > 0 && (
              <span className="flex items-center gap-1 text-sm text-zinc-500">
                &middot; <Star className="h-3.5 w-3.5 fill-amber-400 text-amber-400" />
                {reviewAgg._avg.rating?.toFixed(1)} ({reviewAgg._count})
              </span>
            )}
          </div>
        </div>
        <Link href="/dashboard/business" className={ui.btnSecondary}>
          Edit business profile
        </Link>
      </div>

      {!business.stripeOnboarded && (
        <div className="mt-6 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          Connect your Stripe account to receive payouts when you sell.{" "}
          <Link href="/dashboard/business" className="font-medium underline">
            Set up payouts
          </Link>
        </div>
      )}

      <div className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Active listings"
          value={listingCount}
          href="/dashboard/listings"
          icon={Package}
          tint="bg-brand-soft text-brand"
        />
        <StatCard
          label="Pending offers"
          value={pendingOffersReceived}
          href="/dashboard/offers"
          icon={Handshake}
          tint="bg-amber-50 text-amber-600"
        />
        <StatCard
          label="Open orders"
          value={openOrders}
          href="/dashboard/orders"
          icon={ShoppingBag}
          tint="bg-sky-50 text-sky-600"
        />
        <StatCard
          label="Rating"
          value={reviewAgg._count > 0 ? `${reviewAgg._avg.rating?.toFixed(1)}` : "—"}
          href="/dashboard/orders"
          icon={Star}
          tint="bg-emerald-50 text-emerald-600"
        />
      </div>

      <div className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-3">
        <QuickLink href="/listings/new" title="List inventory" desc="Post excess stock for sale." icon={PackagePlus} />
        <QuickLink href="/listings" title="Browse marketplace" desc="Find discounted bulk inventory to buy." icon={Search} />
        <QuickLink href="/dashboard/saved-searches" title="Saved searches" desc="Get notified about matching listings." icon={Bookmark} />
      </div>
    </div>
  );
}

function StatCard({
  label,
  value,
  href,
  icon: Icon,
  tint,
}: {
  label: string;
  value: number | string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  tint: string;
}) {
  return (
    <Link href={href} className={`${ui.card} ${ui.cardHover} block p-4`}>
      <span className={`flex h-9 w-9 items-center justify-center rounded-lg ${tint}`}>
        <Icon className="h-4.5 w-4.5" />
      </span>
      <p className="mt-3 text-sm text-zinc-500">{label}</p>
      <p className="mt-0.5 text-2xl font-semibold text-zinc-900">{value}</p>
    </Link>
  );
}

function QuickLink({
  href,
  title,
  desc,
  icon: Icon,
}: {
  href: string;
  title: string;
  desc: string;
  icon: React.ComponentType<{ className?: string }>;
}) {
  return (
    <Link href={href} className={`${ui.card} ${ui.cardHover} group flex items-start gap-3 p-4`}>
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-zinc-100 text-zinc-600">
        <Icon className="h-4.5 w-4.5" />
      </span>
      <div className="flex-1">
        <p className="font-medium text-zinc-900">{title}</p>
        <p className="mt-0.5 text-sm text-zinc-500">{desc}</p>
      </div>
      <ArrowRight className="h-4 w-4 shrink-0 text-zinc-300 transition-all group-hover:translate-x-0.5 group-hover:text-brand" />
    </Link>
  );
}
