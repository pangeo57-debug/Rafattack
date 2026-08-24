import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { offerSchema } from "@/lib/validators";
import { notify } from "@/lib/notify";
import { acceptOfferAndCreateTransaction } from "@/lib/offers";

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.businessId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const role = req.nextUrl.searchParams.get("role") ?? "received";

  const offers =
    role === "made"
      ? await prisma.offer.findMany({
          where: { buyerBusinessId: session.user.businessId },
          include: { listing: true, buyerBusiness: true, transaction: true },
          orderBy: { createdAt: "desc" },
        })
      : await prisma.offer.findMany({
          where: { listing: { sellerBusinessId: session.user.businessId } },
          include: { listing: true, buyerBusiness: true, transaction: true },
          orderBy: { createdAt: "desc" },
        });

  return NextResponse.json(offers);
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.businessId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const buyerBusiness = await prisma.business.findUnique({ where: { id: session.user.businessId } });
  if (buyerBusiness?.verificationStatus === "SUSPENDED") {
    return NextResponse.json({ error: "Your account is suspended and can't make offers." }, { status: 403 });
  }

  const json = await req.json();
  const parsed = offerSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });
  }
  const data = parsed.data;
  const buyNow = Boolean(json.buyNow);

  const listing = await prisma.listing.findUnique({ where: { id: data.listingId } });
  if (!listing || listing.status !== "ACTIVE") {
    return NextResponse.json({ error: "Listing is not available." }, { status: 400 });
  }
  if (listing.sellerBusinessId === session.user.businessId) {
    return NextResponse.json({ error: "You cannot make an offer on your own listing." }, { status: 400 });
  }
  if (data.quantity < listing.minOrderQty) {
    return NextResponse.json(
      { error: `Minimum order quantity is ${listing.minOrderQty}.` },
      { status: 400 }
    );
  }
  if (data.quantity > listing.quantityAvailable) {
    return NextResponse.json({ error: "Not enough quantity available." }, { status: 400 });
  }

  const offer = await prisma.offer.create({
    data: {
      listingId: data.listingId,
      buyerBusinessId: session.user.businessId,
      offeredPrice: data.offeredPrice,
      quantity: data.quantity,
      message: data.message,
      status: "PENDING",
    },
  });

  if (buyNow) {
    const transaction = await acceptOfferAndCreateTransaction(
      offer,
      listing,
      data.offeredPrice,
      data.quantity
    );
    return NextResponse.json({ offer, transaction }, { status: 201 });
  }

  await notify(
    listing.sellerBusinessId,
    "OFFER_RECEIVED",
    "New offer received",
    `You received an offer on "${listing.title}".`,
    `/dashboard/offers`
  );

  return NextResponse.json({ offer }, { status: 201 });
}
