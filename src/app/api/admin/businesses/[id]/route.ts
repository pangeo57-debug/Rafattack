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

  const business = await prisma.business.update({
    where: { id },
    data: { verificationStatus, verificationNote },
  });

  await notify(
    business.id,
    "VERIFICATION_UPDATED",
    "Verification status updated",
    `Your business status is now ${verificationStatus}.`,
    "/dashboard/business"
  );

  return NextResponse.json(business);
}
