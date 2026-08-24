import Link from "next/link";
import { notFound } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { ui, badgeColor, formatMoney, formatDate } from "@/lib/ui";
import { LISTING_CONDITIONS, FULFILLMENT_TYPES } from "@/lib/constants";
import OfferBox from "@/components/OfferBox";

export default async function ListingDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const listing = await prisma.listing.findUnique({
    where: { id },
    include: { sellerBusiness: true },
  });
  if (!listing) notFound();

  const session = await auth();
  const isOwner = session?.user?.businessId === listing.sellerBusinessId;
  const photos: string[] = JSON.parse(listing.photos || "[]");
  const condition = LISTING_CONDITIONS.find((c) => c.value === listing.condition)?.label;
  const fulfillment = FULFILLMENT_TYPES.find((f) => f.value === listing.fulfillment)?.label;

  const reviewAgg = await prisma.review.aggregate({
    where: { revieweeBusinessId: listing.sellerBusinessId },
    _avg: { rating: true },
    _count: true,
  });

  return (
    <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6">
      <div className="grid grid-cols-1 gap-8 lg:grid-cols-3">
        <div className="lg:col-span-2">
          {photos.length > 0 ? (
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              {photos.map((src, i) => (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  key={i}
                  src={src}
                  alt={`${listing.title} photo ${i + 1}`}
                  className="aspect-square w-full rounded-md border border-zinc-200 object-cover"
                />
              ))}
            </div>
          ) : (
            <div className="flex aspect-video items-center justify-center rounded-md border border-dashed border-zinc-300 text-zinc-400">
              No photos provided
            </div>
          )}

          <div className="mt-6 flex items-center gap-2">
            <span className={`${ui.badge} ${badgeColor(listing.status)}`}>{listing.status}</span>
            <span className="text-xs font-medium uppercase tracking-wide text-brand">
              {listing.category}
            </span>
          </div>
          <h1 className="mt-2 text-2xl font-semibold text-zinc-900">{listing.title}</h1>
          <p className="mt-3 whitespace-pre-wrap text-zinc-700">{listing.description}</p>

          <dl className="mt-6 grid grid-cols-2 gap-4 rounded-lg border border-zinc-200 bg-white p-4 sm:grid-cols-3">
            <Detail label="Condition" value={condition ?? listing.condition} />
            <Detail label="Quantity available" value={String(listing.quantityAvailable)} />
            <Detail label="Minimum order" value={String(listing.minOrderQty)} />
            <Detail label="Unit of sale" value={listing.unit === "ITEM" ? "Per item" : "Per lot"} />
            <Detail label="Fulfillment" value={fulfillment ?? listing.fulfillment} />
            <Detail label="Location" value={`${listing.locationCity}, ${listing.locationCountry}`} />
            {listing.expiresAt && (
              <Detail label="Listing expires" value={formatDate(listing.expiresAt)} />
            )}
          </dl>

          <div className="mt-6 rounded-lg border border-zinc-200 bg-white p-4">
            <p className="text-sm font-medium text-zinc-900">Seller</p>
            <Link
              href={`/businesses/${listing.sellerBusiness.id}`}
              className="mt-1 block font-medium text-brand hover:underline"
            >
              {listing.sellerBusiness.name}
            </Link>
            <p className="mt-1 text-sm text-zinc-500">
              {listing.sellerBusiness.type} &middot; {listing.sellerBusiness.city},{" "}
              {listing.sellerBusiness.country}
            </p>
            {reviewAgg._count > 0 ? (
              <p className="mt-1 text-sm text-zinc-500">
                {reviewAgg._avg.rating?.toFixed(1)} ★ ({reviewAgg._count} reviews)
              </p>
            ) : (
              <p className="mt-1 text-sm text-zinc-400">No reviews yet</p>
            )}
          </div>
        </div>

        <div>
          <p className="text-3xl font-semibold text-zinc-900">
            {formatMoney(listing.askingPrice)}
            <span className="ml-1 text-base font-normal text-zinc-500">
              / {listing.unit === "ITEM" ? "item" : "lot"}
            </span>
          </p>
          {listing.originalPrice > listing.askingPrice && (
            <p className="text-sm text-zinc-400 line-through">{formatMoney(listing.originalPrice)}</p>
          )}

          <div className="mt-4">
            {isOwner ? (
              <div className="flex flex-col gap-2">
                <Link href={`/listings/${listing.id}/edit`} className={ui.btnSecondary}>
                  Edit listing
                </Link>
                <p className="text-xs text-zinc-400">This is your listing.</p>
              </div>
            ) : !session?.user ? (
              <Link href="/login" className={ui.btnPrimary}>
                Log in to make an offer
              </Link>
            ) : listing.status !== "ACTIVE" ? (
              <p className="text-sm text-zinc-500">This listing is no longer available.</p>
            ) : (
              <OfferBox
                listingId={listing.id}
                askingPrice={listing.askingPrice}
                minOrderQty={listing.minOrderQty}
                quantityAvailable={listing.quantityAvailable}
              />
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs font-medium uppercase tracking-wide text-zinc-400">{label}</dt>
      <dd className="mt-0.5 text-sm text-zinc-800">{value}</dd>
    </div>
  );
}
