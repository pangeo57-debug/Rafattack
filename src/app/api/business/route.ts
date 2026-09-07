import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

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
    if (typeof body[key] === "string") data[key] = body[key];
  }

  if (Array.isArray(body.verificationDocuments)) {
    const documents = body.verificationDocuments
      .filter((d: unknown): d is string => typeof d === "string" && d.length <= 3_000_000)
      .slice(0, 2);
    data.verificationDocuments = JSON.stringify(documents);
  }

  const business = await prisma.business.update({
    where: { id: session.user.businessId },
    data: data as never,
  });
  return NextResponse.json(business);
}
