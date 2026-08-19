import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { listingSchema } from "@/lib/validators";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const listing = await prisma.listing.findUnique({
    where: { id },
    include: { sellerBusiness: true },
  });
  if (!listing) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json(listing);
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const session = await auth();
  if (!session?.user?.businessId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const listing = await prisma.listing.findUnique({ where: { id } });
  if (!listing) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (listing.sellerBusinessId !== session.user.businessId) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const json = await req.json();

  if (json.status && Object.keys(json).length === 1) {
    const updated = await prisma.listing.update({
      where: { id },
      data: { status: json.status },
    });
    return NextResponse.json(updated);
  }

  const parsed = listingSchema.partial().safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });
  }
  const data = parsed.data;

  const updated = await prisma.listing.update({
    where: { id },
    data: {
      ...data,
      photos: data.photos ? JSON.stringify(data.photos) : undefined,
      expiresAt: data.expiresAt ? new Date(data.expiresAt) : undefined,
    },
  });
  return NextResponse.json(updated);
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const session = await auth();
  if (!session?.user?.businessId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const listing = await prisma.listing.findUnique({ where: { id } });
  if (!listing) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (listing.sellerBusinessId !== session.user.businessId) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  await prisma.listing.update({ where: { id }, data: { status: "REMOVED" } });
  return NextResponse.json({ ok: true });
}
