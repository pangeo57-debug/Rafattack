import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { findTransactionAsParty, notFoundResponse } from "@/lib/access";
import { checkRateLimit } from "@/lib/rateLimit";
import { notify } from "@/lib/notify";
import { MAX_MESSAGE_LENGTH, offPlatformWarning } from "@/lib/order-messages";

const schema = z.object({
  body: z.string().trim().min(1, "Write a message.").max(MAX_MESSAGE_LENGTH, `Keep it under ${MAX_MESSAGE_LENGTH} characters.`),
});

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await auth();
  if (!session?.user?.businessId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const businessId = session.user.businessId;

  const access = await findTransactionAsParty(id, businessId);
  if (!access) return notFoundResponse();
  const { transaction, isSeller } = access;

  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });
  }
  if (!(await checkRateLimit(`order-message:${businessId}`, 60, 60))) {
    return NextResponse.json({ error: "You're sending messages too fast. Please wait a bit." }, { status: 429 });
  }

  const message = await prisma.orderMessage.create({
    data: { transactionId: id, senderBusinessId: businessId, body: parsed.data.body },
  });

  await notify(
    isSeller ? transaction.buyerBusinessId : transaction.sellerBusinessId,
    "ORDER_STATUS_CHANGED",
    "New message about your order",
    `${isSeller ? "The seller" : "The buyer"} wrote about "${transaction.listing.title}": ${parsed.data.body.slice(0, 140)}`,
    `/dashboard/orders/${id}#messages`
  );

  return NextResponse.json({ message, warning: offPlatformWarning(parsed.data.body) }, { status: 201 });
}
