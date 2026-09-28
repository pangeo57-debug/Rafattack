import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { offerSchema } from "@/lib/validators";
import { notify } from "@/lib/notify";
import { acceptOfferAndCreateTransaction, InsufficientStockError } from "@/lib/offers";
import { isBusinessSuspended } from "@/lib/session";

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

  if (await isBusinessSuspended(session.user.businessId)) {
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

  // "Buy now" is an instant sale with no seller in the loop, so it must be at
  // the seller's own asking price — never a price sent by the browser.
  const price = buyNow ? listing.askingPriceCents : data.offeredPrice; // cents

  const offer = await prisma.offer.create({
    data: {
      listingId: data.listingId,
      buyerBusinessId: session.user.businessId,
      offeredPriceCents: price,
      quantity: data.quantity,
      message: data.message,
      status: "PENDING",
    },
  });

  if (buyNow) {
    try {
      const transaction = await acceptOfferAndCreateTransaction(offer, listing, price, data.quantity, {
        by: { actor: "BUYER", userId: session.user.id },
        reason: "Bought at the asking price (Buy now)",
      });
      return NextResponse.json({ offer, transaction }, { status: 201 });
    } catch (err) {
      if (err instanceof InsufficientStockError) {
        await prisma.offer.update({ where: { id: offer.id }, data: { status: "WITHDRAWN" } });
        return NextResponse.json({ error: err.message }, { status: 409 });
      }
      throw err;
    }
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
