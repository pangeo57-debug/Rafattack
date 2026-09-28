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
  // Payouts/refunds Stripe hasn't confirmed: retried hourly; FAILED ones
  // need a person (check the Stripe dashboard, then fix by hand).
  const stuck = await prisma.moneyMovement.findMany({
    where: { OR: [{ status: "FAILED" }, { status: "PENDING", attempts: { gt: 0 } }] },
    include: { transaction: { include: { listing: true } } },
    orderBy: { createdAt: "asc" },
  });

  return (
    <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6">
      <h1 className="text-2xl font-semibold text-zinc-900">Transactions</h1>
      {stuck.length > 0 && (
        <div className="mt-6 rounded-lg border border-rose-200 bg-rose-50 p-4" data-testid="stuck-payments">
          <p className="font-medium text-rose-900">Payments needing attention ({stuck.length})</p>
          <ul className="mt-2 space-y-1 text-sm text-rose-800">
            {stuck.map((m) => (
              <li key={m.id}>
                <Link href={`/dashboard/orders/${m.transactionId}`} className="underline">{m.transaction.listing.title}</Link>
                {" · "}
                {m.kind === "SELLER_PAYOUT" ? "Payout to seller" : "Refund to buyer"}
                {m.amountCents ? ` ${formatMoney(m.amountCents / 100)}` : " (full)"} · {m.status === "FAILED" ? "FAILED, gave up" : "retrying"} after{" "}
                {m.attempts} attempt{m.attempts === 1 ? "" : "s"}: {m.lastError}
              </li>
            ))}
          </ul>
        </div>
      )}
      <div className="mt-6 overflow-x-auto rounded-lg border border-zinc-200 bg-white">
        <table className="min-w-full divide-y divide-zinc-200 text-sm">
          <thead className="bg-zinc-50 text-left text-xs font-medium uppercase tracking-wide text-zinc-500">
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
          <tbody className="divide-y divide-zinc-100">
            {transactions.map((t) => (
              <tr key={t.id}>
                <td className="px-4 py-2">
                  <Link href={`/dashboard/orders/${t.id}`} className="text-brand hover:underline">
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
                <td className="px-4 py-2 text-zinc-500">{formatDate(t.createdAt)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {transactions.length === 0 && <p className="p-4 text-zinc-500">No transactions yet.</p>}
      </div>
    </div>
  );
}
