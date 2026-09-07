import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
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
  if (minPrice) where.askingPrice = { ...(where.askingPrice as object), gte: Number(minPrice) };
  if (maxPrice) where.askingPrice = { ...(where.askingPrice as object), lte: Number(maxPrice) };
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

  const listing = await prisma.listing.create({
    data: {
      sellerBusinessId: session.user.businessId,
      title: data.title,
      description: data.description,
      category: data.category,
      photos: JSON.stringify(data.photos ?? []),
      quantityAvailable: data.quantityAvailable,
      unit: data.unit,
      condition: data.condition,
      originalPrice: data.originalPrice,
      askingPrice: data.askingPrice,
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
