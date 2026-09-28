import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { createToken } from "@/lib/tokens";
import { sendEmail, emailShell } from "@/lib/email";
import { checkRateLimit } from "@/lib/rateLimit";

export async function POST() {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const user = await prisma.user.findUnique({ where: { id: session.user.id } });
  if (!user) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (user.emailVerified) {
    return NextResponse.json({ error: "Your email is already verified." }, { status: 400 });
  }

  const allowed = await checkRateLimit(`resend-verification:${user.email}`, 3, 60);
  if (!allowed) {
    return NextResponse.json({ error: "Too many requests. Please try again later." }, { status: 429 });
  }

  const token = await createToken(user.email, "EMAIL_VERIFICATION", 60 * 24);
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
  const link = `${appUrl}/verify-email?token=${token}`;
  await sendEmail(
    user.email,
    "Verify your email — Surplo",
    emailShell(
      "Verify your email",
      `<p>Confirm your email address for Surplo.</p>
       <p><a href="${link}" style="color:#4f46e5;">Verify email</a></p>
       <p>This link expires in 24 hours.</p>`
    )
  );

  return NextResponse.json({ ok: true });
}
