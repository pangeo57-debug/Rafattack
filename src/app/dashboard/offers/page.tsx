import Link from "next/link";
import { requireBusiness } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { ui, badgeColor, formatMoney, formatDate } from "@/lib/ui";
import { OFFER_STATUS_LABELS } from "@/lib/constants";
import OfferActions from "@/components/OfferActions";

export default async function OffersPage({
  searchParams,
}: {
  searchParams: Promise<{ role?: string }>;
}) {
  const { business } = await requireBusiness();
  const sp = await searchParams;
  const role = sp.role === "made" ? "made" : "received";

  const offers =
    role === "made"
      ? await prisma.offer.findMany({
          where: { buyerBusinessId: business.id },
          include: { listing: true, buyerBusiness: true, transaction: true },
          orderBy: { createdAt: "desc" },
        })
      : await prisma.offer.findMany({
          where: { listing: { sellerBusinessId: business.id } },
          include: { listing: true, buyerBusiness: true, transaction: true },
          orderBy: { createdAt: "desc" },
        });

  return (
    <div className="mx-auto max-w-4xl px-4 py-10 sm:px-6">
      <h1 className="text-2xl font-semibold text-slate-900">Offers</h1>

      <div className="mt-4 flex gap-4 border-b border-slate-200 text-sm font-medium">
        <Link
          href="/dashboard/offers?role=received"
          className={`-mb-px border-b-2 px-1 py-2 ${
            role === "received" ? "border-indigo-600 text-indigo-600" : "border-transparent text-slate-500"
          }`}
        >
          Received
        </Link>
        <Link
          href="/dashboard/offers?role=made"
          className={`-mb-px border-b-2 px-1 py-2 ${
            role === "made" ? "border-indigo-600 text-indigo-600" : "border-transparent text-slate-500"
          }`}
        >
          Made
        </Link>
      </div>

      <div className="mt-6 space-y-4">
        {offers.length === 0 && <p className="text-slate-500">No offers here yet.</p>}
        {offers.map((o) => (
          <div key={o.id} className={`${ui.card} p-4`}>
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div>
                <Link href={`/listings/${o.listingId}`} className="font-medium text-slate-900 hover:underline">
                  {o.listing.title}
                </Link>
                {role === "received" && (
                  <p className="text-sm text-slate-500">from {o.buyerBusiness.name}</p>
                )}
                <p className="mt-1 text-sm text-slate-700">
                  {o.quantity} &times; {formatMoney(o.offeredPrice)} = {formatMoney(o.offeredPrice * o.quantity)}
                </p>
                {o.message && <p className="mt-1 text-sm text-slate-500">&ldquo;{o.message}&rdquo;</p>}
                {o.status === "COUNTERED" && (
                  <p className="mt-1 text-sm text-blue-700">
                    Counter: {o.counterQuantity} &times; {formatMoney(o.counterPrice ?? 0)}
                    {o.counterMessage ? ` — "${o.counterMessage}"` : ""}
                  </p>
                )}
                <p className="mt-1 text-xs text-slate-400">{formatDate(o.createdAt)}</p>
              </div>
              <span className={`${ui.badge} ${badgeColor(o.status)}`}>
                {OFFER_STATUS_LABELS[o.status] ?? o.status}
              </span>
            </div>

            {o.transaction ? (
              <Link
                href={`/dashboard/orders/${o.transaction.id}`}
                className="mt-3 inline-block text-sm font-medium text-indigo-600 hover:underline"
              >
                View order &rarr;
              </Link>
            ) : (
              <div className="mt-3">
                <OfferActions offerId={o.id} role={role === "received" ? "seller" : "buyer"} status={o.status} />
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
