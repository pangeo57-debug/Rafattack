import { Search as SearchIcon } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { ui } from "@/lib/ui";
import { LISTING_CATEGORIES, BUSINESS_TYPES } from "@/lib/constants";
import ListingCard from "@/components/ListingCard";
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
      { title: { contains: sp.q, mode: "insensitive" } },
      { description: { contains: sp.q, mode: "insensitive" } },
    ];
  }
  if (sp.category) where.category = sp.category;
  if (sp.location) {
    where.AND = [
      {
        OR: [
          { locationCity: { contains: sp.location, mode: "insensitive" } },
          { locationCountry: { contains: sp.location, mode: "insensitive" } },
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
      <h1 className="text-2xl font-semibold text-zinc-900">Browse inventory</h1>

      <form className={`${ui.card} mt-6 grid grid-cols-2 gap-3 p-4 sm:grid-cols-4 lg:grid-cols-7`}>
        <div className="relative col-span-2">
          <SearchIcon className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400" />
          <input
            name="q"
            defaultValue={sp.q}
            placeholder="Search keyword"
            className={`${ui.input} pl-9`}
          />
        </div>
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

      <p className="mt-4 text-sm text-zinc-500">{listings.length} active listings</p>

      <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {listings.map((l) => (
          <ListingCard
            key={l.id}
            listing={{
              id: l.id,
              title: l.title,
              category: l.category,
              askingPrice: l.askingPrice,
              originalPrice: l.originalPrice,
              unit: l.unit,
              locationCity: l.locationCity,
              locationCountry: l.locationCountry,
              quantityAvailable: l.quantityAvailable,
              minOrderQty: l.minOrderQty,
              sellerBusinessName: l.sellerBusiness.name,
            }}
          />
        ))}
        {listings.length === 0 && (
          <p className="col-span-full text-zinc-500">No listings match your filters.</p>
        )}
      </div>
    </div>
  );
}
