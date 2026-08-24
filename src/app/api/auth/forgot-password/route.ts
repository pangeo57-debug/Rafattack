import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { createToken } from "@/lib/tokens";
import { sendEmail, emailShell } from "@/lib/email";
import { checkRateLimit, clientIp } from "@/lib/rateLimit";

const schema = z.object({ email: z.string().email() });

export async function POST(req: NextRequest) {
  const parsed = schema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "Enter a valid email address." }, { status: 400 });
  }
  const email = parsed.data.email.toLowerCase();

  const ipAllowed = await checkRateLimit(`forgot-password-ip:${clientIp(req)}`, 10, 60);
  const emailAllowed = await checkRateLimit(`forgot-password-email:${email}`, 3, 60);
  if (!ipAllowed || !emailAllowed) {
    return NextResponse.json(
      { error: "Too many reset requests. Please try again later." },
      { status: 429 }
    );
  }

  // Always respond the same way whether or not the account exists, so this
  // endpoint can't be used to enumerate registered emails.
  const user = await prisma.user.findUnique({ where: { email } });
  if (user) {
    const token = await createToken(email, "PASSWORD_RESET", 60);
    const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
    const link = `${appUrl}/reset-password?token=${token}`;
    await sendEmail(
      email,
      "Reset your Overstock Trade password",
      emailShell(
        "Reset your password",
        `<p>We received a request to reset your password. This link expires in 1 hour.</p>
         <p><a href="${link}" style="color:#4f46e5;">Reset password</a></p>
         <p>If you didn't request this, you can safely ignore this email.</p>`
      )
    );
  }

  return NextResponse.json({ ok: true });
}
