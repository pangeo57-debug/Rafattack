import { prisma } from "@/lib/prisma";

/**
 * Simple fixed-window rate limiter backed by Postgres (no Redis dependency).
 * Returns true if the action is allowed, false if the limit was hit.
 */
export async function checkRateLimit(key: string, maxAttempts: number, windowMinutes: number) {
  const now = new Date();
  const windowMs = windowMinutes * 60 * 1000;

  const existing = await prisma.rateLimitAttempt.findUnique({ where: { key } });

  if (!existing || now.getTime() - existing.windowStart.getTime() > windowMs) {
    await prisma.rateLimitAttempt.upsert({
      where: { key },
      update: { count: 1, windowStart: now },
      create: { key, count: 1, windowStart: now },
    });
    return true;
  }

  if (existing.count >= maxAttempts) {
    return false;
  }

  await prisma.rateLimitAttempt.update({
    where: { key },
    data: { count: { increment: 1 } },
  });
  return true;
}

export function clientIp(req: Request) {
  const forwarded = req.headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0].trim();
  return req.headers.get("x-real-ip") ?? "unknown";
}
