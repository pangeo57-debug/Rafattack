import Link from "next/link";
import { Handshake } from "lucide-react";
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
      <h1 className="text-2xl font-semibold text-zinc-900">Offers</h1>

      <div className="mt-4 inline-flex rounded-lg bg-zinc-100 p-1 text-sm font-medium">
        <Link
          href="/dashboard/offers?role=received"
          className={`rounded-md px-3 py-1.5 transition-all ${
            role === "received" ? "bg-white text-zinc-900 shadow-sm" : "text-zinc-500 hover:text-zinc-700"
          }`}
        >
          Received
        </Link>
        <Link
          href="/dashboard/offers?role=made"
          className={`rounded-md px-3 py-1.5 transition-all ${
            role === "made" ? "bg-white text-zinc-900 shadow-sm" : "text-zinc-500 hover:text-zinc-700"
          }`}
        >
          Made
        </Link>
      </div>

      <div className="mt-6 space-y-4">
        {offers.length === 0 && (
          <div className={`${ui.card} flex flex-col items-center gap-2 p-10 text-center`}>
            <Handshake className="h-8 w-8 text-zinc-300" />
            <p className="text-zinc-500">No offers here yet.</p>
          </div>
        )}
        {offers.map((o) => (
          <div key={o.id} className={`${ui.card} p-4`}>
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div className="flex items-start gap-3">
                <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-brand-soft text-brand">
                  <Handshake className="h-4.5 w-4.5" />
                </span>
                <div>
                  <Link href={`/listings/${o.listingId}`} className="font-medium text-zinc-900 hover:underline">
                    {o.listing.title}
                  </Link>
                  {role === "received" && (
                    <p className="text-sm text-zinc-500">from {o.buyerBusiness.name}</p>
                  )}
                  <p className="mt-1 text-sm text-zinc-700">
                    {o.quantity} &times; {formatMoney(o.offeredPrice)} = {formatMoney(o.offeredPrice * o.quantity)}
                  </p>
                  {o.message && <p className="mt-1 text-sm text-zinc-500">&ldquo;{o.message}&rdquo;</p>}
                  {o.status === "COUNTERED" && (
                    <p className="mt-1 text-sm text-sky-700">
                      Counter: {o.counterQuantity} &times; {formatMoney(o.counterPrice ?? 0)}
                      {o.counterMessage ? ` — "${o.counterMessage}"` : ""}
                    </p>
                  )}
                  <p className="mt-1 text-xs text-zinc-400">{formatDate(o.createdAt)}</p>
                </div>
              </div>
              <span className={`${ui.badge} ${badgeColor(o.status)}`}>
                {OFFER_STATUS_LABELS[o.status] ?? o.status}
              </span>
            </div>

            {o.transaction ? (
              <Link
                href={`/dashboard/orders/${o.transaction.id}`}
                className="mt-3 inline-block text-sm font-medium text-brand hover:underline"
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
