import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { requireStripe } from "@/lib/stripe";
import { notify } from "@/lib/notify";

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const session = await auth();
  if (session?.user?.platformRole !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const { resolution, note } = await req.json();
  if (!["SELLER", "BUYER"].includes(resolution)) {
    return NextResponse.json({ error: "resolution must be SELLER or BUYER" }, { status: 400 });
  }

  const transaction = await prisma.transaction.findUnique({ where: { id } });
  if (!transaction) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (transaction.orderStatus !== "DISPUTED") {
    return NextResponse.json({ error: "This order is not under dispute." }, { status: 400 });
  }

  const stripe = requireStripe();

  if (resolution === "SELLER") {
    if (transaction.stripePaymentIntentId) {
      await stripe.paymentIntents.capture(transaction.stripePaymentIntentId);
    }
    const updated = await prisma.transaction.update({
      where: { id },
      data: {
        orderStatus: "COMPLETED",
        paymentStatus: "CAPTURED",
        escrowStatus: "RELEASED",
        disputeStatus: "RESOLVED_SELLER",
        disputeNote: note,
        completedAt: new Date(),
      },
    });
    await notify(transaction.sellerBusinessId, "DISPUTE_UPDATED", "Dispute resolved in your favor", "The order has been marked completed and your payout released.", `/dashboard/orders/${id}`);
    await notify(transaction.buyerBusinessId, "DISPUTE_UPDATED", "Dispute resolved", "The dispute was resolved in the seller's favor.", `/dashboard/orders/${id}`);
    return NextResponse.json(updated);
  }

  if (transaction.stripePaymentIntentId) {
    await stripe.paymentIntents.cancel(transaction.stripePaymentIntentId);
  }
  const updated = await prisma.transaction.update({
    where: { id },
    data: {
      orderStatus: "CANCELLED",
      paymentStatus: "REFUNDED",
      escrowStatus: "REFUNDED",
      disputeStatus: "RESOLVED_BUYER",
      disputeNote: note,
      cancelledAt: new Date(),
    },
  });
  await notify(transaction.buyerBusinessId, "DISPUTE_UPDATED", "Dispute resolved in your favor", "Your payment has been released back to you.", `/dashboard/orders/${id}`);
  await notify(transaction.sellerBusinessId, "DISPUTE_UPDATED", "Dispute resolved", "The dispute was resolved in the buyer's favor.", `/dashboard/orders/${id}`);
  return NextResponse.json(updated);
}
