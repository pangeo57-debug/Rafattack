import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { listingSchema } from "@/lib/validators";
import { isBusinessSuspended } from "@/lib/session";
import { findOwnListing, notFoundResponse } from "@/lib/access";

const SELLER_SETTABLE: string[] = ["ACTIVE", "PAUSED"];

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

  const listing = await findOwnListing(id, session.user.businessId);
  if (!listing) return notFoundResponse();
  if (await isBusinessSuspended(session.user.businessId)) {
    return NextResponse.json({ error: "Your account is suspended and can't edit listings." }, { status: 403 });
  }

  const json = await req.json();

  if (json.status && Object.keys(json).length === 1) {
    // Sellers may only pause and resume. SOLD_OUT, EXPIRED and REMOVED are
    // set by the system (sales, expiry, deletion, suspension) and can't be
    // undone from the browser.
    if (!SELLER_SETTABLE.includes(json.status) || !SELLER_SETTABLE.includes(listing.status)) {
      return NextResponse.json({ error: "This listing's status can't be changed." }, { status: 400 });
    }
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
  const listing = await findOwnListing(id, session.user.businessId);
  if (!listing) return notFoundResponse();
  await prisma.listing.update({ where: { id }, data: { status: "REMOVED" } });
  return NextResponse.json({ ok: true });
}
