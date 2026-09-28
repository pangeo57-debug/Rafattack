import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { removeListing, dismissReport } from "@/lib/moderation";

const schema = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("REMOVE"),
    ground: z.enum(["ILLEGAL_CONTENT", "TERMS_VIOLATION"]),
    facts: z.string().trim().min(10, "Explain to the seller why, in at least 10 characters.").max(3000),
    termsSection: z.string().trim().max(200).optional(),
  }),
  z.object({
    action: z.literal("DISMISS"),
    note: z.string().trim().min(10, "Explain to the reporter why, in at least 10 characters.").max(3000),
  }),
]);

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await auth();
  if (session?.user?.platformRole !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });
  }
  const report = await prisma.listingReport.findUnique({ where: { id } });
  if (!report) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const d = parsed.data;
  const ok =
    d.action === "REMOVE"
      ? await removeListing({
          listingId: report.listingId,
          adminUserId: session.user.id,
          ground: d.ground,
          facts: d.facts,
          termsSection: d.termsSection || null,
          reportId: report.id,
        })
      : await dismissReport(report.id, d.note);

  if (!ok) return NextResponse.json({ error: "This report was already decided." }, { status: 409 });
  return NextResponse.json({ ok: true });
}
