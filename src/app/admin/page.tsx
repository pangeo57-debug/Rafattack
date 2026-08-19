import Link from "next/link";
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
      <h1 className="text-2xl font-semibold text-slate-900">Admin dashboard</h1>

      <nav className="mt-4 flex gap-4 text-sm font-medium text-indigo-600">
        <Link href="/admin/businesses" className="hover:underline">
          Businesses
        </Link>
        <Link href="/admin/transactions" className="hover:underline">
          Transactions
        </Link>
        <Link href="/admin/disputes" className="hover:underline">
          Disputes
        </Link>
        <Link href="/admin/settings" className="hover:underline">
          Settings
        </Link>
      </nav>

      <div className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <Stat label="Businesses" value={businessCount} />
        <Stat label="Pending verification" value={pendingVerification} href="/admin/businesses" />
        <Stat label="Active listings" value={listingCount} />
        <Stat label="Total transactions" value={transactionCount} href="/admin/transactions" />
        <Stat label="Gross merchandise value" value={formatMoney(completedAgg._sum.amount ?? 0)} />
        <Stat label="Commission revenue" value={formatMoney(completedAgg._sum.commissionAmount ?? 0)} />
        <Stat label="Open disputes" value={openDisputes} href="/admin/disputes" />
      </div>
    </div>
  );
}

function Stat({ label, value, href }: { label: string; value: number | string; href?: string }) {
  const content = (
    <div className={`${ui.card} p-4 ${href ? "hover:border-indigo-300" : ""}`}>
      <p className="text-sm text-slate-500">{label}</p>
      <p className="mt-1 text-2xl font-semibold text-slate-900">{value}</p>
    </div>
  );
  return href ? <Link href={href}>{content}</Link> : content;
}
