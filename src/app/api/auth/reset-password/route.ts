import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { consumeToken } from "@/lib/tokens";
import { checkRateLimit, clientIp } from "@/lib/rateLimit";

const schema = z.object({
  token: z.string().min(10),
  password: z.string().min(8, "Password must be at least 8 characters"),
});

export async function POST(req: NextRequest) {
  const allowed = await checkRateLimit(`reset-password-ip:${clientIp(req)}`, 20, 60);
  if (!allowed) {
    return NextResponse.json({ error: "Too many attempts. Please try again later." }, { status: 429 });
  }

  const parsed = schema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });
  }

  const email = await consumeToken(parsed.data.token, "PASSWORD_RESET");
  if (!email) {
    return NextResponse.json({ error: "This reset link is invalid or has expired." }, { status: 400 });
  }

  const passwordHash = await bcrypt.hash(parsed.data.password, 10);
  await prisma.user.update({
    where: { email },
    data: { passwordHash, failedLoginAttempts: 0, lockedUntil: null },
  });

  return NextResponse.json({ ok: true });
}
