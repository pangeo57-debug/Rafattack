import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { findOwnBuyOrder, notFoundResponse } from "@/lib/access";
import { isBusinessSuspended } from "@/lib/session";

const schema = z.object({ action: z.enum(["PAUSE", "RESUME", "CANCEL"]) });

// Allowed moves, in one place. FILLED/EXPIRED/CANCELLED are final.
const FROM = {
  PAUSE: ["ACTIVE"],
  RESUME: ["PAUSED"],
  CANCEL: ["ACTIVE", "PAUSED"],
} as const;
const TO = { PAUSE: "PAUSED", RESUME: "ACTIVE", CANCEL: "CANCELLED" } as const;

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await auth();
  if (!session?.user?.businessId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const bid = await findOwnBuyOrder(id, session.user.businessId);
  if (!bid) return notFoundResponse();

  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid action" }, { status: 400 });
  const { action } = parsed.data;

  if (action === "RESUME") {
    if (await isBusinessSuspended(session.user.businessId)) {
      return NextResponse.json({ error: "Your account is suspended." }, { status: 403 });
    }
    if (bid.expiresAt <= new Date()) {
      return NextResponse.json({ error: "This request has ended. Post a new one." }, { status: 400 });
    }
    if (bid.remainingQty < bid.minLotQty) {
      return NextResponse.json({ error: "Nothing left to buy on this request." }, { status: 400 });
    }
  }

  const moved = await prisma.buyOrder.updateMany({
    where: { id, status: { in: [...FROM[action]] } },
    data: { status: TO[action], pausedReason: null },
  });
  if (moved.count === 0) {
    return NextResponse.json({ error: "This request can't be changed any more." }, { status: 400 });
  }
  return NextResponse.json(await prisma.buyOrder.findUniqueOrThrow({ where: { id } }));
}
