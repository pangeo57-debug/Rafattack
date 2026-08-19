import Link from "next/link";
import { requireBusiness } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { ui, badgeColor, formatMoney, formatDate } from "@/lib/ui";
import { ORDER_STATUS_LABELS } from "@/lib/constants";

export default async function OrdersPage() {
  const { business } = await requireBusiness();

  const transactions = await prisma.transaction.findMany({
    where: { OR: [{ sellerBusinessId: business.id }, { buyerBusinessId: business.id }] },
    include: { listing: true, sellerBusiness: true, buyerBusiness: true },
    orderBy: { createdAt: "desc" },
  });

  return (
    <div className="mx-auto max-w-4xl px-4 py-10 sm:px-6">
      <h1 className="text-2xl font-semibold text-slate-900">Orders</h1>

      <div className="mt-6 space-y-3">
        {transactions.length === 0 && <p className="text-slate-500">No orders yet.</p>}
        {transactions.map((t) => {
          const isSeller = t.sellerBusinessId === business.id;
          return (
            <Link
              key={t.id}
              href={`/dashboard/orders/${t.id}`}
              className={`${ui.card} flex flex-wrap items-center justify-between gap-3 p-4 hover:border-indigo-300`}
            >
              <div>
                <p className="font-medium text-slate-900">{t.listing.title}</p>
                <p className="text-sm text-slate-500">
                  {isSeller ? "Selling to" : "Buying from"}{" "}
                  {isSeller ? t.buyerBusiness.name : t.sellerBusiness.name} &middot;{" "}
                  {formatMoney(t.amount)} &middot; {formatDate(t.createdAt)}
                </p>
              </div>
              <span className={`${ui.badge} ${badgeColor(t.orderStatus)}`}>
                {ORDER_STATUS_LABELS[t.orderStatus] ?? t.orderStatus}
              </span>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
