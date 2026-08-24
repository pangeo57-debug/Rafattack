import Link from "next/link";
import { Package, PackagePlus } from "lucide-react";
import { requireBusiness } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { ui, badgeColor, formatMoney } from "@/lib/ui";
import ListingStatusActions from "@/components/ListingStatusActions";

export default async function MyListingsPage() {
  const { business } = await requireBusiness();
  const listings = await prisma.listing.findMany({
    where: { sellerBusinessId: business.id },
    orderBy: { createdAt: "desc" },
  });

  return (
    <div className="mx-auto max-w-5xl px-4 py-10 sm:px-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold text-zinc-900">My listings</h1>
        <Link href="/listings/new" className={ui.btnPrimary}>
          <PackagePlus className="h-4 w-4" />
          List inventory
        </Link>
      </div>

      <div className="mt-6 space-y-3">
        {listings.length === 0 && <p className="text-zinc-500">You haven&apos;t listed anything yet.</p>}
        {listings.map((l) => (
          <div key={l.id} className={`${ui.card} ${ui.cardHover} flex flex-wrap items-center justify-between gap-3 p-4`}>
            <div className="flex items-center gap-3">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-brand-soft text-brand">
                <Package className="h-4.5 w-4.5" />
              </span>
              <div>
                <div className="flex items-center gap-2">
                  <Link href={`/listings/${l.id}`} className="font-medium text-zinc-900 hover:underline">
                    {l.title}
                  </Link>
                  <span className={`${ui.badge} ${badgeColor(l.status)}`}>{l.status}</span>
                </div>
                <p className="mt-1 text-sm text-zinc-500">
                  {formatMoney(l.askingPrice)} / {l.unit === "ITEM" ? "item" : "lot"} &middot; Qty{" "}
                  {l.quantityAvailable}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Link href={`/listings/${l.id}/edit`} className={ui.btnSecondary}>
                Edit
              </Link>
              <ListingStatusActions listingId={l.id} status={l.status} />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
