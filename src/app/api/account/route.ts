import { NextResponse } from "next/server";
import crypto from "crypto";
import bcrypt from "bcryptjs";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

const OPEN_ORDER_STATUSES = ["AWAITING_PAYMENT", "PAID", "SHIPPED", "PICKED_UP", "DISPUTED"] as const;

export async function DELETE() {
  const session = await auth();
  if (!session?.user?.businessId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const businessId = session.user.businessId;

  const openOrders = await prisma.transaction.count({
    where: {
      OR: [{ sellerBusinessId: businessId }, { buyerBusinessId: businessId }],
      orderStatus: { in: [...OPEN_ORDER_STATUSES] },
    },
  });
  if (openOrders > 0) {
    return NextResponse.json(
      {
        error:
          "You have orders in progress. Complete, cancel, or resolve them before deleting your account.",
      },
      { status: 409 }
    );
  }

  const users = await prisma.user.findMany({ where: { businessId } });

  await prisma.$transaction(async (tx) => {
    await tx.listing.updateMany({
      where: { sellerBusinessId: businessId, status: { in: ["ACTIVE", "PAUSED"] } },
      data: { status: "REMOVED" },
    });

    await tx.offer.updateMany({
      where: { listing: { sellerBusinessId: businessId }, status: "PENDING" },
      data: { status: "WITHDRAWN" },
    });
    await tx.offer.updateMany({
      where: { buyerBusinessId: businessId, status: { in: ["PENDING", "COUNTERED"] } },
      data: { status: "WITHDRAWN" },
    });

    for (const user of users) {
      const unusableHash = await bcrypt.hash(crypto.randomBytes(32).toString("hex"), 10);
      await tx.user.update({
        where: { id: user.id },
        data: {
          email: `deleted-${user.id}@deleted.overstocktrade.invalid`,
          name: "Deleted user",
          passwordHash: unusableHash,
        },
      });
    }

    await tx.business.update({
      where: { id: businessId },
      data: {
        name: "Deleted business",
        contactEmail: `deleted-${businessId}@deleted.overstocktrade.invalid`,
        contactPhone: null,
        address: null,
        taxId: `deleted-${businessId}`,
        verificationStatus: "SUSPENDED",
        stripeAccountId: null,
        stripeOnboarded: false,
        deletedAt: new Date(),
      },
    });
  });

  return NextResponse.json({ ok: true });
}
