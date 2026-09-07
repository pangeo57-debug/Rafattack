import crypto from "crypto";
import { prisma } from "@/lib/prisma";
import type { TokenType } from "@prisma/client";

export async function createToken(identifier: string, type: TokenType, ttlMinutes: number) {
  // Invalidate any existing outstanding tokens of this type for this identifier.
  await prisma.verificationToken.deleteMany({ where: { identifier, type } });

  const token = crypto.randomBytes(32).toString("hex");
  await prisma.verificationToken.create({
    data: {
      identifier,
      token,
      type,
      expiresAt: new Date(Date.now() + ttlMinutes * 60 * 1000),
    },
  });
  return token;
}

export async function consumeToken(token: string, type: TokenType) {
  const record = await prisma.verificationToken.findUnique({ where: { token } });
  if (!record || record.type !== type) return null;
  if (record.expiresAt < new Date()) {
    await prisma.verificationToken.delete({ where: { token } }).catch(() => {});
    return null;
  }
  await prisma.verificationToken.delete({ where: { token } }).catch(() => {});
  return record.identifier;
}
