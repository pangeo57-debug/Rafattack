import Link from "next/link";
import { ShoppingBag, ArrowUpRight, ArrowDownLeft } from "lucide-react";
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
      <h1 className="text-2xl font-semibold text-zinc-900">Orders</h1>

      <div className="mt-6 space-y-3">
        {transactions.length === 0 && (
          <div className={`${ui.card} flex flex-col items-center gap-2 p-10 text-center`}>
            <ShoppingBag className="h-8 w-8 text-zinc-300" />
            <p className="text-zinc-500">No orders yet.</p>
          </div>
        )}
        {transactions.map((t) => {
          const isSeller = t.sellerBusinessId === business.id;
          return (
            <Link
              key={t.id}
              href={`/dashboard/orders/${t.id}`}
              className={`${ui.card} ${ui.cardHover} flex flex-wrap items-center justify-between gap-3 p-4`}
            >
              <div className="flex items-center gap-3">
                <span
                  className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${
                    isSeller ? "bg-emerald-50 text-emerald-600" : "bg-sky-50 text-sky-600"
                  }`}
                >
                  {isSeller ? <ArrowUpRight className="h-4.5 w-4.5" /> : <ArrowDownLeft className="h-4.5 w-4.5" />}
                </span>
                <div>
                  <p className="font-medium text-zinc-900">{t.listing.title}</p>
                  <p className="text-sm text-zinc-500">
                    {isSeller ? "Selling to" : "Buying from"}{" "}
                    {isSeller ? t.buyerBusiness.name : t.sellerBusiness.name} &middot;{" "}
                    {formatMoney(t.amount)} &middot; {formatDate(t.createdAt)}
                  </p>
                </div>
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
