import { NextRequest, NextResponse } from "next/server";
import { timingSafeEqual } from "crypto";
import { runOrderTimers } from "@/lib/order-timers";

// Called every hour by netlify/functions/order-timers.mts. Refuses to run
// unless CRON_SECRET is configured and presented (fail closed): this endpoint
// cancels orders and moves money.
export async function POST(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    return NextResponse.json({ error: "CRON_SECRET is not configured." }, { status: 503 });
  }
  const given = Buffer.from(req.headers.get("authorization") ?? "");
  const expected = Buffer.from(`Bearer ${secret}`);
  if (given.length !== expected.length || !timingSafeEqual(given, expected)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const result = await runOrderTimers();
  return NextResponse.json(result);
}
