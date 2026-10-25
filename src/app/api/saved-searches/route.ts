import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { savedSearchSchema } from "@/lib/validators";

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.businessId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const parsed = savedSearchSchema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });
  }
  const savedSearch = await prisma.savedSearch.create({
    data: {
      businessId: session.user.businessId,
      keyword: parsed.data.keyword,
      category: parsed.data.category,
      location: parsed.data.location,
      minPriceCents: parsed.data.minPrice, // already cents (validators.euros)
      maxPriceCents: parsed.data.maxPrice,
    },
  });
  return NextResponse.json(savedSearch, { status: 201 });
}
