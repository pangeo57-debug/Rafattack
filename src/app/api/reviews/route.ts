import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { reviewSchema } from "@/lib/validators";
import { notify } from "@/lib/notify";

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.businessId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const businessId = session.user.businessId;

  const parsed = reviewSchema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });
  }
  const { transactionId, rating, comment } = parsed.data;

  const transaction = await prisma.transaction.findUnique({ where: { id: transactionId } });
  if (!transaction) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (transaction.orderStatus !== "COMPLETED") {
    return NextResponse.json({ error: "You can only review completed orders." }, { status: 400 });
  }

  const isSeller = transaction.sellerBusinessId === businessId;
  const isBuyer = transaction.buyerBusinessId === businessId;
  if (!isSeller && !isBuyer) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const existing = await prisma.review.findUnique({
    where: { transactionId_reviewerBusinessId: { transactionId, reviewerBusinessId: businessId } },
  });
  if (existing) {
    return NextResponse.json({ error: "You've already reviewed this order." }, { status: 409 });
  }

  const revieweeBusinessId = isBuyer ? transaction.sellerBusinessId : transaction.buyerBusinessId;

  const review = await prisma.review.create({
    data: {
      transactionId,
      reviewerBusinessId: businessId,
      revieweeBusinessId,
      rating,
      comment,
    },
  });

  await notify(
    revieweeBusinessId,
    "REVIEW_RECEIVED",
    "New review received",
    `You received a ${rating}-star review.`,
    `/businesses/${revieweeBusinessId}`
  );

  return NextResponse.json(review, { status: 201 });
}
