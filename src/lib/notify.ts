import { prisma } from "@/lib/prisma";
import type { NotificationType } from "@prisma/client";

export async function notify(
  businessId: string,
  type: NotificationType,
  title: string,
  body: string,
  link?: string
) {
  await prisma.notification.create({
    data: { businessId, type, title, body, link },
  });
}

export async function notifyMatchingSavedSearches(listing: {
  id: string;
  title: string;
  category: string;
  askingPrice: number;
  locationCity: string;
  locationCountry: string;
  sellerBusinessId: string;
}) {
  const searches = await prisma.savedSearch.findMany({
    where: { business: { id: { not: listing.sellerBusinessId } } },
  });

  const matches = searches.filter((s) => {
    if (s.category && s.category !== listing.category) return false;
    if (s.minPrice != null && listing.askingPrice < s.minPrice) return false;
    if (s.maxPrice != null && listing.askingPrice > s.maxPrice) return false;
    if (s.keyword && !listing.title.toLowerCase().includes(s.keyword.toLowerCase()))
      return false;
    if (
      s.location &&
      !`${listing.locationCity} ${listing.locationCountry}`
        .toLowerCase()
        .includes(s.location.toLowerCase())
    )
      return false;
    return true;
  });

  const uniqueBusinessIds = Array.from(new Set(matches.map((m) => m.businessId)));
  for (const businessId of uniqueBusinessIds) {
    await notify(
      businessId,
      "LISTING_MATCH",
      "New listing matches your saved search",
      listing.title,
      `/listings/${listing.id}`
    );
  }
}
