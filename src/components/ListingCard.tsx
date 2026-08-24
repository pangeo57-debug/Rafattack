import Link from "next/link";
import { Package, MapPin, BadgeCheck } from "lucide-react";
import { ui, formatMoney } from "@/lib/ui";

type ListingCardData = {
  id: string;
  title: string;
  category: string;
  askingPrice: number;
  originalPrice?: number;
  unit: string;
  locationCity: string;
  locationCountry: string;
  quantityAvailable?: number;
  minOrderQty?: number;
  sellerBusinessName?: string;
  sellerVerified?: boolean;
};

export default function ListingCard({ listing }: { listing: ListingCardData }) {
  const discount =
    listing.originalPrice && listing.originalPrice > listing.askingPrice
      ? Math.round((1 - listing.askingPrice / listing.originalPrice) * 100)
      : null;

  return (
    <Link
      href={`/listings/${listing.id}`}
      className={`${ui.card} ${ui.cardHover} group block overflow-hidden p-0`}
    >
      <div className="relative flex h-32 items-center justify-center bg-gradient-to-br from-brand-soft to-white">
        <Package className="h-10 w-10 text-brand/40" strokeWidth={1.5} />
        {discount && (
          <span className="absolute right-2.5 top-2.5 rounded-full bg-rose-500 px-2 py-0.5 text-xs font-semibold text-white shadow-sm">
            -{discount}%
          </span>
        )}
      </div>
      <div className="p-4">
        <p className="text-xs font-medium uppercase tracking-wide text-brand">{listing.category}</p>
        <h3 className="mt-1 truncate font-medium text-zinc-900 transition-colors group-hover:text-brand">
          {listing.title}
        </h3>
        {listing.sellerBusinessName && (
          <p className="mt-1 flex items-center gap-1.5 truncate text-sm text-zinc-500">
            <span className="truncate">{listing.sellerBusinessName}</span>
            {listing.sellerVerified && <BadgeCheck className="h-3.5 w-3.5 shrink-0 text-emerald-500" />}
          </p>
        )}
        <p className="mt-1 flex items-center gap-1 text-xs text-zinc-400">
          <MapPin className="h-3 w-3" />
          {listing.locationCity}, {listing.locationCountry}
        </p>
        {listing.quantityAvailable != null && (
          <p className="mt-1.5 text-xs text-zinc-500">
            Qty {listing.quantityAvailable} &middot; MOQ {listing.minOrderQty}
          </p>
        )}
        <p className="mt-3 text-lg font-semibold text-zinc-900">
          {formatMoney(listing.askingPrice)}
          <span className="ml-1 text-sm font-normal text-zinc-500">
            / {listing.unit === "ITEM" ? "item" : "lot"}
          </span>
          {listing.originalPrice && listing.originalPrice > listing.askingPrice && (
            <span className="ml-2 text-sm font-normal text-zinc-400 line-through">
              {formatMoney(listing.originalPrice)}
            </span>
          )}
        </p>
      </div>
    </Link>
  );
}
