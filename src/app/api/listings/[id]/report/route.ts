import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { checkRateLimit, clientIp } from "@/lib/rateLimit";
import { sendEmail, emailShell, escapeHtml } from "@/lib/email";
import { REPORT_REASONS } from "@/lib/constants";
import type { ReportReason } from "@prisma/client";

const schema = z.object({
  reason: z.enum(REPORT_REASONS.map((r) => r.value) as [ReportReason, ...ReportReason[]]),
  explanation: z.string().trim().min(20, "Please explain in at least 20 characters why this listing is a problem.").max(3000),
  name: z.string().trim().min(2, "Please enter your name.").max(120),
  email: z.string().trim().email("Please enter a valid email so we can tell you the outcome.").max(200),
  goodFaith: z.literal(true, { error: "Please confirm the report is accurate and made in good faith." }),
});

// Digital Services Act Art. 16: anyone, signed in or not, can report a
// listing. Creating data, so it is rate limited per IP and per email.
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });
  }
  const data = parsed.data;

  const okIp = await checkRateLimit(`listing-report-ip:${clientIp(req)}`, 5, 60);
  const okEmail = await checkRateLimit(`listing-report-email:${data.email.toLowerCase()}`, 10, 24 * 60);
  if (!okIp || !okEmail) {
    return NextResponse.json({ error: "Too many reports. Please try again later." }, { status: 429 });
  }

  const listing = await prisma.listing.findUnique({ where: { id }, select: { id: true, title: true, status: true } });
  if (!listing || listing.status === "REMOVED") {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const session = await auth();
  await prisma.listingReport.create({
    data: {
      listingId: listing.id,
      reporterUserId: session?.user?.id ?? null,
      reporterName: data.name,
      reporterEmail: data.email,
      reason: data.reason,
      explanation: data.explanation,
    },
  });

  // Receipt (Art. 16(4)).
  await sendEmail(
    data.email,
    "We received your report",
    emailShell(
      "We received your report",
      `<p>Thank you. A person will review your report about "${escapeHtml(listing.title)}" and we will email you the outcome.</p>`
    )
  );

  return NextResponse.json({ ok: true }, { status: 201 });
}
