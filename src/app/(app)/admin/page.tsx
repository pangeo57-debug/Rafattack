import Link from "next/link";
import {
  Users,
  ShieldAlert,
  Package,
  Receipt,
  TrendingUp,
  Wallet,
  AlertTriangle,
} from "lucide-react";
import { requireAdmin } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { ui, formatMoney } from "@/lib/ui";

export default async function AdminOverviewPage() {
  await requireAdmin();

  const [
    businessCount,
    pendingVerification,
    listingCount,
    transactionCount,
    completedAgg,
    openDisputes,
  ] = await Promise.all([
    prisma.business.count(),
    prisma.business.count({ where: { verificationStatus: "PENDING" } }),
    prisma.listing.count({ where: { status: "ACTIVE" } }),
    prisma.transaction.count(),
    prisma.transaction.aggregate({
      where: { orderStatus: "COMPLETED" },
      _sum: { amount: true, commissionAmount: true },
    }),
    prisma.transaction.count({ where: { orderStatus: "DISPUTED" } }),
  ]);

  return (
    <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6">
      <h1 className="text-2xl font-semibold text-zinc-900">Admin dashboard</h1>
      <p className="mt-1 text-sm text-zinc-500">Platform-wide activity and health at a glance.</p>

      <div className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <Stat label="Businesses" value={businessCount} icon={Users} tint="bg-brand-soft text-brand" />
        <Stat
          label="Pending verification"
          value={pendingVerification}
          href="/admin/businesses"
          icon={ShieldAlert}
          tint="bg-amber-50 text-amber-600"
        />
        <Stat label="Active listings" value={listingCount} icon={Package} tint="bg-sky-50 text-sky-600" />
        <Stat
          label="Total transactions"
          value={transactionCount}
          href="/admin/transactions"
          icon={Receipt}
          tint="bg-violet-50 text-violet-600"
        />
        <Stat
          label="Gross merchandise value"
          value={formatMoney(completedAgg._sum.amount ?? 0)}
          icon={TrendingUp}
          tint="bg-emerald-50 text-emerald-600"
        />
        <Stat
          label="Commission revenue"
          value={formatMoney(completedAgg._sum.commissionAmount ?? 0)}
          icon={Wallet}
          tint="bg-emerald-50 text-emerald-600"
        />
        <Stat
          label="Open disputes"
          value={openDisputes}
          href="/admin/disputes"
          icon={AlertTriangle}
          tint="bg-rose-50 text-rose-600"
        />
      </div>
    </div>
  );
}

function Stat({
  label,
  value,
  href,
  icon: Icon,
  tint,
}: {
  label: string;
  value: number | string;
  href?: string;
  icon: React.ComponentType<{ className?: string }>;
  tint: string;
}) {
  const content = (
    <div className={`${ui.card} ${href ? ui.cardHover : ""} p-4`}>
      <span className={`flex h-9 w-9 items-center justify-center rounded-lg ${tint}`}>
        <Icon className="h-4.5 w-4.5" />
      </span>
      <p className="mt-3 text-sm text-zinc-500">{label}</p>
      <p className="mt-0.5 text-2xl font-semibold text-zinc-900">{value}</p>
    </div>
  );
  return href ? <Link href={href}>{content}</Link> : content;
}
