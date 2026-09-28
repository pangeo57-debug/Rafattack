import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
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
  const { verificationStatus, verificationNote } = await req.json();
  const allowed = ["PENDING", "VERIFIED", "REJECTED", "SUSPENDED"];
  if (!allowed.includes(verificationStatus)) {
    return NextResponse.json({ error: "Invalid status" }, { status: 400 });
  }
  // Suspension and rejection restrict the account, so the business must get
  // the reason and how to contest it (DSA Art. 17), not just the new status.
  const restricted = verificationStatus === "SUSPENDED" || verificationStatus === "REJECTED";
  if (restricted && (typeof verificationNote !== "string" || verificationNote.trim().length < 10)) {
    return NextResponse.json({ error: "Give the reason the business will read (at least 10 characters)." }, { status: 400 });
  }

  const business = await prisma.business.update({
    where: { id },
    data: {
      verificationStatus,
      verificationNote,
      // ID documents are kept only until a decision is made (data
      // minimisation). If the business needs a new check, it uploads again.
      ...(verificationStatus !== "PENDING" ? { verificationDocuments: "[]" } : {}),
    },
  });

  if (verificationStatus === "SUSPENDED") {
    await prisma.listing.updateMany({
      where: { sellerBusinessId: id, status: { in: ["ACTIVE", "PAUSED"] } },
      data: { status: "REMOVED" },
    });
    await prisma.offer.updateMany({
      where: { listing: { sellerBusinessId: id }, status: "PENDING" },
      data: { status: "WITHDRAWN" },
    });
    await prisma.offer.updateMany({
      where: { buyerBusinessId: id, status: { in: ["PENDING", "COUNTERED"] } },
      data: { status: "WITHDRAWN" },
    });
    await prisma.buyOrder.updateMany({
      where: { buyerBusinessId: id, status: { in: ["ACTIVE", "PAUSED"] } },
      data: { status: "CANCELLED" },
    });
  }

  await notify(
    business.id,
    "VERIFICATION_UPDATED",
    "Verification status updated",
    restricted
      ? `Your business status is now ${verificationStatus}. Reason: ${verificationNote?.trim() || "not given"}. ` +
          (verificationStatus === "SUSPENDED" ? "Your active listings were removed and open offers withdrawn. " : "") +
          "A person made this decision. Reply to our support address to ask for a review; you can also use a certified out-of-court dispute settlement body or go to court."
      : `Your business status is now ${verificationStatus}.`,
    "/dashboard/business"
  );

  return NextResponse.json(business);
}
