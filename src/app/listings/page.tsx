import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { ui, formatMoney } from "@/lib/ui";
import { LISTING_CATEGORIES, BUSINESS_TYPES } from "@/lib/constants";
import type { Prisma } from "@prisma/client";

type SearchParams = {
  q?: string;
  category?: string;
  location?: string;
  minPrice?: string;
  maxPrice?: string;
  minQty?: string;
  businessType?: string;
};

export default async function BrowseListingsPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const sp = await searchParams;

  const where: Prisma.ListingWhereInput = { status: "ACTIVE" };
  if (sp.q) {
    where.OR = [
      { title: { contains: sp.q } },
      { description: { contains: sp.q } },
    ];
  }
  if (sp.category) where.category = sp.category;
  if (sp.location) {
    where.AND = [
      {
        OR: [
          { locationCity: { contains: sp.location } },
          { locationCountry: { contains: sp.location } },
        ],
      },
    ];
  }
  if (sp.minPrice) where.askingPrice = { ...(where.askingPrice as object), gte: Number(sp.minPrice) };
  if (sp.maxPrice) where.askingPrice = { ...(where.askingPrice as object), lte: Number(sp.maxPrice) };
  if (sp.minQty) where.quantityAvailable = { gte: Number(sp.minQty) };
  if (sp.businessType) where.sellerBusiness = { type: sp.businessType as never };

  const listings = await prisma.listing.findMany({
    where,
    orderBy: { createdAt: "desc" },
    include: { sellerBusiness: true },
    take: 60,
  });

  return (
    <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6">
      <h1 className="text-2xl font-semibold text-slate-900">Browse inventory</h1>

      <form className="mt-6 grid grid-cols-2 gap-3 rounded-lg border border-slate-200 bg-white p-4 sm:grid-cols-4 lg:grid-cols-7">
        <input
          name="q"
          defaultValue={sp.q}
          placeholder="Search keyword"
          className={`${ui.input} col-span-2`}
        />
        <select name="category" defaultValue={sp.category ?? ""} className={ui.input}>
          <option value="">Any category</option>
          {LISTING_CATEGORIES.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
        <select name="businessType" defaultValue={sp.businessType ?? ""} className={ui.input}>
          <option value="">Any seller type</option>
          {BUSINESS_TYPES.map((t) => (
            <option key={t.value} value={t.value}>
              {t.label}
            </option>
          ))}
        </select>
        <input
          name="location"
          defaultValue={sp.location}
          placeholder="City or country"
          className={ui.input}
        />
        <input
          name="minPrice"
          type="number"
          step="0.01"
          defaultValue={sp.minPrice}
          placeholder="Min price"
          className={ui.input}
        />
        <input
          name="maxPrice"
          type="number"
          step="0.01"
          defaultValue={sp.maxPrice}
          placeholder="Max price"
          className={ui.input}
        />
        <button type="submit" className={`${ui.btnPrimary} col-span-2 sm:col-span-1`}>
          Filter
        </button>
      </form>

      <p className="mt-4 text-sm text-slate-500">{listings.length} active listings</p>

      <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {listings.map((l) => (
          <Link
            key={l.id}
            href={`/listings/${l.id}`}
            className={`${ui.card} block p-4 hover:border-indigo-300`}
          >
            <p className="text-xs font-medium uppercase tracking-wide text-indigo-600">
              {l.category}
            </p>
            <h3 className="mt-1 font-medium text-slate-900">{l.title}</h3>
            <p className="mt-1 text-sm text-slate-500">
              {l.sellerBusiness.name} &middot; {l.locationCity}, {l.locationCountry}
            </p>
            <p className="mt-1 text-sm text-slate-500">
              Qty available: {l.quantityAvailable} &middot; MOQ {l.minOrderQty}
            </p>
            <p className="mt-3 text-lg font-semibold text-slate-900">
              {formatMoney(l.askingPrice)}
              <span className="ml-1 text-sm font-normal text-slate-500">
                / {l.unit === "ITEM" ? "item" : "lot"}
              </span>
              {l.originalPrice > l.askingPrice && (
                <span className="ml-2 text-sm font-normal text-slate-400 line-through">
                  {formatMoney(l.originalPrice)}
                </span>
              )}
            </p>
          </Link>
        ))}
        {listings.length === 0 && (
          <p className="col-span-full text-slate-500">No listings match your filters.</p>
        )}
      </div>
    </div>
  );
}
