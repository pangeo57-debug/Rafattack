import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { cleanImages, ImageRejected } from "@/lib/images";
import { prisma } from "@/lib/prisma";
import { notify } from "@/lib/notify";

export async function PATCH(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.businessId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const body = await req.json();
  const allowed = [
    "name",
    "type",
    "category",
    "country",
    "city",
    "address",
    "taxId",
    "contactEmail",
    "contactPhone",
  ] as const;
  const data: Record<string, string> = {};
  for (const key of allowed) {
    if (typeof body[key] === "string") data[key] = body[key].trim();
  }
  for (const key of ["name", "taxId", "contactEmail", "city", "country"] as const) {
    if (data[key] === "") {
      return NextResponse.json({ error: `${key === "taxId" ? "Tax ID" : key} can't be empty.` }, { status: 400 });
    }
  }

  if (Array.isArray(body.verificationDocuments)) {
    if (body.verificationDocuments.length > 2) {
      return NextResponse.json({ error: "Upload at most 2 documents." }, { status: 400 });
    }
    try {
      data.verificationDocuments = JSON.stringify(await cleanImages(body.verificationDocuments));
    } catch (err) {
      if (err instanceof ImageRejected) return NextResponse.json({ error: err.message }, { status: 400 });
      throw err;
    }
  }

  // The "Verified" badge vouches for this name and tax ID. Changing either
  // sends a verified business back for a fresh check; a rejected or
  // suspended one keeps its status (editing must not lift a suspension).
  const current = await prisma.business.findUniqueOrThrow({ where: { id: session.user.businessId } });
  const identityChanged =
    (data.name !== undefined && data.name !== current.name) ||
    (data.taxId !== undefined && data.taxId !== current.taxId);
  const reverify = identityChanged && current.verificationStatus === "VERIFIED";

  const business = await prisma.business.update({
    where: { id: session.user.businessId },
    data: { ...data, ...(reverify ? { verificationStatus: "PENDING" as const } : {}) } as never,
  });
  if (reverify) {
    await notify(
      business.id,
      "VERIFICATION_UPDATED",
      "Verification needed again",
      "You changed your business name or tax ID, so your business needs to be verified again. Upload your registration document in your business profile.",
      "/dashboard/business"
    );
  }
  return NextResponse.json({ ...business, reverificationRequired: reverify });
}
