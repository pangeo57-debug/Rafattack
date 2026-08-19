import Link from "next/link";
import { requireAdmin } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { ui, badgeColor, formatMoney, formatDate } from "@/lib/ui";
import { ORDER_STATUS_LABELS } from "@/lib/constants";

export default async function AdminTransactionsPage() {
  await requireAdmin();
  const transactions = await prisma.transaction.findMany({
    orderBy: { createdAt: "desc" },
    include: { listing: true, sellerBusiness: true, buyerBusiness: true },
    take: 100,
  });

  return (
    <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6">
      <h1 className="text-2xl font-semibold text-slate-900">Transactions</h1>
      <div className="mt-6 overflow-x-auto rounded-lg border border-slate-200 bg-white">
        <table className="min-w-full divide-y divide-slate-200 text-sm">
          <thead className="bg-slate-50 text-left text-xs font-medium uppercase tracking-wide text-slate-500">
            <tr>
              <th className="px-4 py-2">Listing</th>
              <th className="px-4 py-2">Seller</th>
              <th className="px-4 py-2">Buyer</th>
              <th className="px-4 py-2">Amount</th>
              <th className="px-4 py-2">Commission</th>
              <th className="px-4 py-2">Status</th>
              <th className="px-4 py-2">Created</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {transactions.map((t) => (
              <tr key={t.id}>
                <td className="px-4 py-2">
                  <Link href={`/dashboard/orders/${t.id}`} className="text-indigo-600 hover:underline">
                    {t.listing.title}
                  </Link>
                </td>
                <td className="px-4 py-2">{t.sellerBusiness.name}</td>
                <td className="px-4 py-2">{t.buyerBusiness.name}</td>
                <td className="px-4 py-2">{formatMoney(t.amount)}</td>
                <td className="px-4 py-2">{formatMoney(t.commissionAmount)}</td>
                <td className="px-4 py-2">
                  <span className={`${ui.badge} ${badgeColor(t.orderStatus)}`}>
                    {ORDER_STATUS_LABELS[t.orderStatus] ?? t.orderStatus}
                  </span>
                </td>
                <td className="px-4 py-2 text-slate-500">{formatDate(t.createdAt)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {transactions.length === 0 && <p className="p-4 text-slate-500">No transactions yet.</p>}
      </div>
    </div>
  );
}
