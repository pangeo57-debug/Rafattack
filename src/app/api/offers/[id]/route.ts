import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { offerRespondSchema } from "@/lib/validators";
import { notify } from "@/lib/notify";
import { acceptOfferAndCreateTransaction, InsufficientStockError } from "@/lib/offers";
import { isBusinessSuspended } from "@/lib/session";

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const session = await auth();
  if (!session?.user?.businessId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const businessId = session.user.businessId;

  const offer = await prisma.offer.findUnique({
    where: { id },
    include: { listing: true },
  });
  if (!offer) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const json = await req.json();
  const parsed = offerRespondSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });
  }
  const { action, counterPrice, counterQuantity, counterMessage } = parsed.data;

  const isSeller = offer.listing.sellerBusinessId === businessId;
  const isBuyer = offer.buyerBusinessId === businessId;
  if (!isSeller && !isBuyer) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  if (action === "WITHDRAW") {
    if (!isBuyer || offer.status === "ACCEPTED") {
      return NextResponse.json({ error: "Cannot withdraw this offer." }, { status: 400 });
    }
    const updated = await prisma.offer.update({
      where: { id },
      data: { status: "WITHDRAWN" },
    });
    return NextResponse.json(updated);
  }

  if (action === "ACCEPT" || action === "COUNTER") {
    if (await isBusinessSuspended(businessId)) {
      return NextResponse.json({ error: "Your account is suspended." }, { status: 403 });
    }
  }

  if (offer.status === "PENDING") {
    if (!isSeller) {
      return NextResponse.json({ error: "Only the seller can respond to a new offer." }, { status: 403 });
    }
    if (action === "ACCEPT") {
      try {
        const transaction = await acceptOfferAndCreateTransaction(
          offer,
          offer.listing,
          offer.offeredPrice,
          offer.quantity
        );
        return NextResponse.json({ offer, transaction });
      } catch (err) {
        if (err instanceof InsufficientStockError) {
          return NextResponse.json({ error: err.message }, { status: 409 });
        }
        throw err;
      }
    }
    if (action === "REJECT") {
      const updated = await prisma.offer.update({ where: { id }, data: { status: "REJECTED" } });
      await notify(
        offer.buyerBusinessId,
        "OFFER_UPDATED",
        "Offer rejected",
        `Your offer on "${offer.listing.title}" was rejected.`,
        `/dashboard/offers`
      );
      return NextResponse.json(updated);
    }
    if (action === "COUNTER") {
      if (!counterPrice || !counterQuantity) {
        return NextResponse.json({ error: "Counter price and quantity are required." }, { status: 400 });
      }
      const updated = await prisma.offer.update({
        where: { id },
        data: { status: "COUNTERED", counterPrice, counterQuantity, counterMessage },
      });
      await notify(
        offer.buyerBusinessId,
        "OFFER_UPDATED",
        "Seller sent a counter-offer",
        `The seller countered your offer on "${offer.listing.title}".`,
        `/dashboard/offers`
      );
      return NextResponse.json(updated);
    }
  }

  if (offer.status === "COUNTERED") {
    if (!isBuyer) {
      return NextResponse.json({ error: "Only the buyer can respond to a counter-offer." }, { status: 403 });
    }
    if (action === "ACCEPT") {
      try {
        const transaction = await acceptOfferAndCreateTransaction(
          offer,
          offer.listing,
          offer.counterPrice!,
          offer.counterQuantity!
        );
        return NextResponse.json({ offer, transaction });
      } catch (err) {
        if (err instanceof InsufficientStockError) {
          return NextResponse.json({ error: err.message }, { status: 409 });
        }
        throw err;
      }
    }
    if (action === "REJECT") {
      const updated = await prisma.offer.update({ where: { id }, data: { status: "REJECTED" } });
      return NextResponse.json(updated);
    }
  }

  return NextResponse.json({ error: "Invalid action for this offer's status." }, { status: 400 });
}
