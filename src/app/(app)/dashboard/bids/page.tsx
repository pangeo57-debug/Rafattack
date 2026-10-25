import Link from "next/link";
import { requireBusiness } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { ui, badgeColor, formatDate } from "@/lib/ui";
import { formatCents } from "@/lib/money";
import { LISTING_CONDITIONS } from "@/lib/constants";
import BuyRequestForm from "@/components/BuyRequestForm";
import BuyRequestActions from "@/components/BuyRequestActions";

export default async function BuyRequestsPage() {
  const { business } = await requireBusiness();
  const requests = await prisma.buyOrder.findMany({
    where: { buyerBusinessId: business.id },
    include: { offers: { where: { transaction: { isNot: null } }, include: { transaction: true } } },
    orderBy: [{ status: "asc" }, { createdAt: "desc" }],
    take: 100,
  });

  return (
    <div className="mx-auto max-w-3xl px-4 py-10 sm:px-6">
      <h1 className="text-2xl font-semibold text-zinc-900">Buy requests</h1>
      <p className="mt-1 text-sm text-zinc-600">
        Tell sellers what you&apos;re looking for. Matching stock comes to you; you don&apos;t have to keep searching.{" "}
        <Link href="/wanted" className="text-brand hover:underline">See what other buyers want</Link>.
      </p>

      <div className="mt-6">
        {business.verificationStatus === "VERIFIED" ? (
          <BuyRequestForm defaultCountry={business.country} defaultCity={business.city} />
        ) : (
          <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
            Buy requests promise sellers a verified buyer, so only verified businesses can post them.{" "}
            <Link href="/dashboard/business" className="font-medium underline">Verify your business</Link>.
          </div>
        )}
      </div>

      <div className="mt-8 space-y-3">
        {requests.length === 0 && <p className="text-zinc-500">No buy requests yet.</p>}
        {requests.map((r) => {
          const bought = r.quantityWanted - r.remainingQty;
          return (
            <div key={r.id} className={`${ui.card} p-4`}>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="font-medium text-zinc-900">
                  {r.category} · up to {formatCents(r.maxUnitPriceCents, r.currency)}/unit
                </p>
                <span className={`${ui.badge} ${badgeColor(r.status)}`}>{r.status}</span>
              </div>
              <p className="mt-1 text-sm text-zinc-500">
                {r.conditions.map((c) => LISTING_CONDITIONS.find((x) => x.value === c)?.label ?? c).join(", ")} ·{" "}
                {r.city ? `${r.city}, ${r.country}` : `anywhere in ${r.country}`} · lots of {r.minLotQty}+ ·{" "}
                {bought} of {r.quantityWanted} bought · until {formatDate(r.expiresAt)}
              </p>
              {r.status === "PAUSED" && r.pausedReason && (
                <p className="mt-2 rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-800">{r.pausedReason}</p>
              )}
              {r.offers.length > 0 && (
                <ul className="mt-2 space-y-1 text-sm">
                  {r.offers.map((o) => (
                    <li key={o.id}>
                      <Link href={`/dashboard/orders/${o.transaction!.id}`} className="text-brand hover:underline">
                        Order #{o.transaction!.id.slice(-8)}: {o.quantity} units · {o.transaction!.orderStatus}
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
              <div className="mt-3">
                <BuyRequestActions id={r.id} status={r.status} />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
