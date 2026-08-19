import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

export async function PATCH(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const session = await auth();
  if (!session?.user?.businessId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const notification = await prisma.notification.findUnique({ where: { id } });
  if (!notification || notification.businessId !== session.user.businessId) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  const updated = await prisma.notification.update({ where: { id }, data: { isRead: true } });
  return NextResponse.json(updated);
}
