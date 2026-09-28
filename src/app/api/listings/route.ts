import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { cleanImages, ImageRejected } from "@/lib/images";
import { prisma } from "@/lib/prisma";
import { parseEuroToCents } from "@/lib/money";
import { listingSchema } from "@/lib/validators";
import { notifyMatchingSavedSearches } from "@/lib/notify";
import { isBusinessSuspended } from "@/lib/session";
import type { Prisma } from "@prisma/client";

export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  const q = sp.get("q")?.trim();
  const category = sp.get("category");
  const location = sp.get("location")?.trim();
  const minPrice = sp.get("minPrice");
  const maxPrice = sp.get("maxPrice");
  const minQty = sp.get("minQty");
  const businessType = sp.get("businessType");

  const where: Prisma.ListingWhereInput = { status: "ACTIVE" };
  if (q) {
    where.OR = [
      { title: { contains: q, mode: "insensitive" } },
      { description: { contains: q, mode: "insensitive" } },
    ];
  }
  if (category) where.category = category;
  if (location) {
    where.AND = [
      ...(Array.isArray(where.AND) ? where.AND : where.AND ? [where.AND] : []),
      {
        OR: [
          { locationCity: { contains: location, mode: "insensitive" } },
          { locationCountry: { contains: location, mode: "insensitive" } },
        ],
      },
    ];
  }
  // Filters are typed in euros; a value that isn't a price is ignored, not an error page.
  const minCents = minPrice ? parseEuroToCents(minPrice) : null;
  const maxCents = maxPrice ? parseEuroToCents(maxPrice) : null;
  if (minCents !== null) where.askingPriceCents = { ...(where.askingPriceCents as object), gte: minCents };
  if (maxCents !== null) where.askingPriceCents = { ...(where.askingPriceCents as object), lte: maxCents };
  if (minQty) where.quantityAvailable = { gte: Number(minQty) };
  if (businessType) where.sellerBusiness = { type: businessType as never };

  const listings = await prisma.listing.findMany({
    where,
    orderBy: { createdAt: "desc" },
    include: { sellerBusiness: true },
    take: 60,
  });

  return NextResponse.json(listings);
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.businessId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (await isBusinessSuspended(session.user.businessId)) {
    return NextResponse.json({ error: "Your account is suspended and can't list inventory." }, { status: 403 });
  }

  const json = await req.json();
  const parsed = listingSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });
  }
  const data = parsed.data;

  let photos: string[];
  try {
    photos = await cleanImages(data.photos ?? []);
  } catch (err) {
    if (err instanceof ImageRejected) return NextResponse.json({ error: err.message }, { status: 400 });
    throw err;
  }

  const listing = await prisma.listing.create({
    data: {
      sellerBusinessId: session.user.businessId,
      title: data.title,
      description: data.description,
      category: data.category,
      photos: JSON.stringify(photos),
      quantityAvailable: data.quantityAvailable,
      unit: data.unit,
      condition: data.condition,
      originalPriceCents: data.originalPriceCents,
      askingPriceCents: data.askingPriceCents,
      minOrderQty: data.minOrderQty,
      fulfillment: data.fulfillment,
      locationCity: data.locationCity,
      locationCountry: data.locationCountry,
      expiresAt: data.expiresAt ? new Date(data.expiresAt) : null,
    },
  });

  notifyMatchingSavedSearches({ ...listing }).catch(() => {});

  return NextResponse.json(listing, { status: 201 });
}
