import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { signupSchema } from "@/lib/validators";

export async function POST(req: NextRequest) {
  const json = await req.json();
  const parsed = signupSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });
  }
  const data = parsed.data;

  const existing = await prisma.user.findUnique({ where: { email: data.email.toLowerCase() } });
  if (existing) {
    return NextResponse.json({ error: "An account with that email already exists." }, { status: 409 });
  }

  const passwordHash = await bcrypt.hash(data.password, 10);

  const result = await prisma.$transaction(async (tx) => {
    const business = await tx.business.create({
      data: {
        name: data.businessName,
        type: data.businessType,
        category: data.category,
        country: data.country,
        city: data.city,
        address: data.address,
        taxId: data.taxId,
        contactEmail: data.email.toLowerCase(),
        contactPhone: data.contactPhone,
      },
    });
    const user = await tx.user.create({
      data: {
        email: data.email.toLowerCase(),
        passwordHash,
        name: data.name,
        businessId: business.id,
      },
    });
    return { business, user };
  });

  return NextResponse.json({ id: result.user.id });
}
