import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { signupSchema } from "@/lib/validators";
import { checkRateLimit, clientIp } from "@/lib/rateLimit";
import { createToken } from "@/lib/tokens";
import { sendEmail, emailShell } from "@/lib/email";

export async function POST(req: NextRequest) {
  const allowed = await checkRateLimit(`signup:${clientIp(req)}`, 8, 60);
  if (!allowed) {
    return NextResponse.json(
      { error: "Too many signup attempts from this network. Please try again later." },
      { status: 429 }
    );
  }

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

  const token = await createToken(data.email.toLowerCase(), "EMAIL_VERIFICATION", 60 * 24);
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
  const link = `${appUrl}/verify-email?token=${token}`;
  await sendEmail(
    data.email.toLowerCase(),
    "Verify your email — Overstock Trade",
    emailShell(
      "Verify your email",
      `<p>Welcome to Overstock Trade! Confirm your email to finish setting up ${data.businessName}.</p>
       <p><a href="${link}" style="color:#4f46e5;">Verify email</a></p>
       <p>This link expires in 24 hours.</p>`
    )
  ).catch(() => {});

  return NextResponse.json({ id: result.user.id });
}
