import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { checkRateLimit } from "@/lib/rateLimit";
import { buyOrderSchema, MAX_ACTIVE_BUY_ORDERS, notifySellersOfNewBuyOrder } from "@/lib/buy-orders";

const DAY = 24 * 60 * 60 * 1000;

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.businessId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const businessId = session.user.businessId;

  // A request tells sellers "a verified buyer is waiting"; that promise only
  // holds if the buyer really is verified.
  const business = await prisma.business.findUniqueOrThrow({ where: { id: businessId } });
  if (business.verificationStatus !== "VERIFIED") {
    return NextResponse.json({ error: "Only verified businesses can post buy requests. Verify your business first." }, { status: 403 });
  }
  if (!(await checkRateLimit(`buy-order-create:${businessId}`, 20, 24 * 60))) {
    return NextResponse.json({ error: "Too many buy requests today. Try again tomorrow." }, { status: 429 });
  }
  const active = await prisma.buyOrder.count({ where: { buyerBusinessId: businessId, status: { in: ["ACTIVE", "PAUSED"] } } });
  if (active >= MAX_ACTIVE_BUY_ORDERS) {
    return NextResponse.json({ error: `You can have at most ${MAX_ACTIVE_BUY_ORDERS} open buy requests.` }, { status: 400 });
  }

  const parsed = buyOrderSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });
  }
  const d = parsed.data;

  const bid = await prisma.buyOrder.create({
    data: {
      buyerBusinessId: businessId,
      category: d.category,
      conditions: d.conditions,
      maxUnitPriceCents: d.maxUnitPriceCents,
      quantityWanted: d.quantityWanted,
      remainingQty: d.quantityWanted,
      minLotQty: d.minLotQty,
      country: d.country,
      city: d.city,
      expiresAt: new Date(Date.now() + d.expiresInDays * DAY),
    },
  });

  await notifySellersOfNewBuyOrder(bid);
  return NextResponse.json(bid, { status: 201 });
}
