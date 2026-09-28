import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { checkRateLimit } from "@/lib/rateLimit";

// GDPR Art. 15 and 20: a copy of everything we hold about this business, as
// a JSON file. Other businesses appear only by id and name, which the user
// already sees in the app; never their contact details or tax ID.
const party = { select: { id: true, name: true } } as const;

export async function GET() {
  const session = await auth();
  if (!session?.user?.businessId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const businessId = session.user.businessId;

  if (!(await checkRateLimit(`data-export:${businessId}`, 5, 60))) {
    return NextResponse.json({ error: "Too many exports. Please try again in an hour." }, { status: 429 });
  }

  const [business, users, listings, offersMade, offersReceived, purchases, sales, reviewsGiven, reviewsReceived, savedSearches, notifications, reportsFiled, buyRequests] =
    await Promise.all([
      prisma.business.findUniqueOrThrow({ where: { id: businessId } }),
      prisma.user.findMany({
        where: { businessId },
        select: { id: true, email: true, name: true, platformRole: true, emailVerified: true, createdAt: true, updatedAt: true },
      }),
      prisma.listing.findMany({
        where: { sellerBusinessId: businessId },
        include: { moderation: { select: { ground: true, facts: true, termsSection: true, createdAt: true } } },
      }),
      prisma.offer.findMany({ where: { buyerBusinessId: businessId }, include: { listing: { select: { id: true, title: true, sellerBusiness: party } } } }),
      prisma.offer.findMany({ where: { listing: { sellerBusinessId: businessId } }, include: { buyerBusiness: party } }),
      prisma.transaction.findMany({ where: { buyerBusinessId: businessId }, include: { sellerBusiness: party } }),
      prisma.transaction.findMany({ where: { sellerBusinessId: businessId }, include: { buyerBusiness: party } }),
      prisma.review.findMany({ where: { reviewerBusinessId: businessId }, include: { revieweeBusiness: party } }),
      prisma.review.findMany({ where: { revieweeBusinessId: businessId }, include: { reviewerBusiness: party } }),
      prisma.savedSearch.findMany({ where: { businessId } }),
      prisma.notification.findMany({ where: { businessId } }),
      prisma.listingReport.findMany({
        where: { reporterUserId: session.user.id },
        select: { listingId: true, reason: true, explanation: true, status: true, decisionNote: true, createdAt: true },
      }),
      prisma.buyOrder.findMany({ where: { buyerBusinessId: businessId } }),
    ]);

  const exportedAt = new Date();
  const body = JSON.stringify(
    {
      exportedAt: exportedAt.toISOString(),
      note: "All data Surplo holds about your business. Times are UTC. Other businesses are shown by name only.",
      business,
      users,
      listings,
      offersMade,
      offersReceived,
      purchases,
      sales,
      reviewsGiven,
      reviewsReceived,
      savedSearches,
      notifications,
      reportsFiled,
      buyRequests,
    },
    null,
    2
  );

  return new NextResponse(body, {
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Content-Disposition": `attachment; filename="surplo-data-${exportedAt.toISOString().slice(0, 10)}.json"`,
      "Cache-Control": "no-store",
    },
  });
}
