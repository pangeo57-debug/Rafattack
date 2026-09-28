import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/auth";
import { isBusinessSuspended } from "@/lib/session";
import { checkRateLimit } from "@/lib/rateLimit";
import { fillBuyOrder, FillError } from "@/lib/buy-orders";

const schema = z.object({
  listingId: z.string().min(1),
  quantity: z.coerce.number().int().positive().optional(),
});

// A seller sells stock from their own listing to a buyer's standing request.
// The price is the request's; nothing about money comes from this body.
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await auth();
  if (!session?.user?.businessId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (await isBusinessSuspended(session.user.businessId)) {
    return NextResponse.json({ error: "Your account is suspended and can't sell." }, { status: 403 });
  }
  if (!(await checkRateLimit(`buy-order-fill:${session.user.businessId}`, 30, 60))) {
    return NextResponse.json({ error: "Too many attempts. Please wait a bit." }, { status: 429 });
  }
  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid request" }, { status: 400 });

  try {
    const transaction = await fillBuyOrder({
      buyOrderId: id,
      listingId: parsed.data.listingId,
      sellerBusinessId: session.user.businessId,
      sellerUserId: session.user.id,
      quantity: parsed.data.quantity,
    });
    return NextResponse.json({ transaction }, { status: 201 });
  } catch (err) {
    if (err instanceof FillError) return NextResponse.json({ error: err.message }, { status: err.status });
    throw err;
  }
}
