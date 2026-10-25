import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { notify } from "@/lib/notify";
import { resolveDispute } from "@/lib/order-actions";

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

  // The state machine locks the order row: a double click or a second admin
  // tab resolves it once, and moves money once.
  const text = typeof note === "string" && note.trim() ? note.trim() : "No note";
  if (!(await resolveDispute(id, resolution, text, session.user.id))) {
    return NextResponse.json({ error: "This order is not under dispute." }, { status: 400 });
  }

  const updated = await prisma.transaction.findUniqueOrThrow({ where: { id } });
  if (resolution === "SELLER") {
    await notify(transaction.sellerBusinessId, "DISPUTE_UPDATED", "Dispute resolved in your favor", "The order has been marked completed and your payout released.", `/dashboard/orders/${id}`);
    await notify(transaction.buyerBusinessId, "DISPUTE_UPDATED", "Dispute resolved", "The dispute was resolved in the seller's favor.", `/dashboard/orders/${id}`);
  } else {
    await notify(transaction.buyerBusinessId, "DISPUTE_UPDATED", "Dispute resolved in your favor", "Your payment has been released back to you.", `/dashboard/orders/${id}`);
    await notify(transaction.sellerBusinessId, "DISPUTE_UPDATED", "Dispute resolved", "The dispute was resolved in the buyer's favor.", `/dashboard/orders/${id}`);
  }
  return NextResponse.json(updated);
}
