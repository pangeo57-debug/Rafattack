import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

export async function PATCH() {
  const session = await auth();
  if (!session?.user?.businessId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  await prisma.notification.updateMany({
    where: { businessId: session.user.businessId, isRead: false },
    data: { isRead: true },
  });
  return NextResponse.json({ ok: true });
}
