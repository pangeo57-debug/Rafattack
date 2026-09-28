import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { parseEuroToCents } from "@/lib/money";

export async function PATCH(req: NextRequest) {
  const session = await auth();
  if (session?.user?.platformRole !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const { commissionPercent } = await req.json();
  // "8" or "7.5" (%) -> 800 / 750 basis points, parsed from the text.
  const bps = parseEuroToCents(commissionPercent);
  if (bps === null || bps > 10000) {
    return NextResponse.json({ error: "Commission must be a percentage between 0 and 100, like 8 or 7.5." }, { status: 400 });
  }

  const setting = await prisma.platformSetting.upsert({
    where: { id: "singleton" },
    update: { commissionBps: bps },
    create: { id: "singleton", commissionBps: bps },
  });
  return NextResponse.json(setting);
}
