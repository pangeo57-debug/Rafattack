import Link from "next/link";
import { requireAdmin } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { ui, formatMoney, formatDate } from "@/lib/ui";
import DisputeResolutionActions from "@/components/DisputeResolutionActions";

export default async function AdminDisputesPage() {
  await requireAdmin();
  const disputes = await prisma.transaction.findMany({
    where: { orderStatus: "DISPUTED" },
    include: { listing: true, sellerBusiness: true, buyerBusiness: true },
    orderBy: { createdAt: "desc" },
  });

  return (
    <div className="mx-auto max-w-4xl px-4 py-10 sm:px-6">
      <h1 className="text-2xl font-semibold text-zinc-900">Dispute queue</h1>
      <div className="mt-6 space-y-4">
        {disputes.length === 0 && <p className="text-zinc-500">No open disputes.</p>}
        {disputes.map((t) => (
          <div key={t.id} className={`${ui.card} p-4`}>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <Link href={`/dashboard/orders/${t.id}`} className="font-medium text-zinc-900 hover:underline">
                {t.listing.title}
              </Link>
              <p className="text-sm text-zinc-500">{formatDate(t.createdAt)}</p>
            </div>
            <p className="mt-1 text-sm text-zinc-500">
              Seller: {t.sellerBusiness.name} &middot; Buyer: {t.buyerBusiness.name} &middot;{" "}
              {formatMoney(t.amount)}
            </p>
            {t.disputeReason && (
              <p className="mt-2 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
                {t.disputeReason}
              </p>
            )}
            <DisputeResolutionActions transactionId={t.id} />
          </div>
        ))}
      </div>
    </div>
  );
}
