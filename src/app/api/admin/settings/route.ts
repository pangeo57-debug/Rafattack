import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

export async function PATCH(req: NextRequest) {
  const session = await auth();
  if (session?.user?.platformRole !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const { commissionPercent } = await req.json();
  const value = Number(commissionPercent);
  if (!Number.isFinite(value) || value < 0 || value > 100) {
    return NextResponse.json({ error: "Commission must be between 0 and 100." }, { status: 400 });
  }

  const setting = await prisma.platformSetting.upsert({
    where: { id: "singleton" },
    update: { commissionPercent: value },
    create: { id: "singleton", commissionPercent: value },
  });
  return NextResponse.json(setting);
}
