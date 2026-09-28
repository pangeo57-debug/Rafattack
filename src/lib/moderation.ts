import type { ModerationGround } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { notify } from "@/lib/notify";
import { sendEmail, emailShell, escapeHtml } from "@/lib/email";

// Digital Services Act, in one place:
//  - Art. 16: anyone can report a listing; they get a receipt and the outcome.
//  - Art. 17: when we remove a listing, the seller gets a statement of reasons
//    (what, why, on which ground, that a human decided, how to contest).

export const GROUND_LABELS: Record<ModerationGround, string> = {
  ILLEGAL_CONTENT: "Illegal content under applicable law",
  TERMS_VIOLATION: "Breach of the Surplo Terms",
};

const REDRESS =
  "If you think this decision is wrong, reply to this email or write to our support address and a person will review it again. " +
  "You can also use a certified out-of-court dispute settlement body (Art. 21 Digital Services Act) or go to court.";

/**
 * Remove a listing and record why. The report (if any) and every other open
 * report on the same listing are closed as actioned. Returns false if the
 * report was already decided (double click, second admin tab).
 */
export async function removeListing(input: {
  listingId: string;
  adminUserId: string;
  ground: ModerationGround;
  facts: string;
  termsSection?: string | null;
  reportId?: string | null;
}): Promise<boolean> {
  const done = await prisma.$transaction(async (tx) => {
    if (input.reportId) {
      const claim = await tx.listingReport.updateMany({
        where: { id: input.reportId, listingId: input.listingId, status: "OPEN" },
        data: { status: "ACTIONED", decidedAt: new Date(), decisionNote: input.facts },
      });
      if (claim.count === 0) return false;
    }
    await tx.listing.update({ where: { id: input.listingId }, data: { status: "REMOVED" } });
    await tx.offer.updateMany({
      where: { listingId: input.listingId, status: { in: ["PENDING", "COUNTERED"] } },
      data: { status: "WITHDRAWN" },
    });
    await tx.moderationDecision.create({
      data: {
        listingId: input.listingId,
        reportId: input.reportId ?? null,
        adminUserId: input.adminUserId,
        ground: input.ground,
        facts: input.facts,
        termsSection: input.termsSection ?? null,
      },
    });
    await tx.listingReport.updateMany({
      where: { listingId: input.listingId, status: "OPEN" },
      data: { status: "ACTIONED", decidedAt: new Date(), decisionNote: input.facts },
    });
    return true;
  });
  if (!done) return false;

  const listing = await prisma.listing.findUniqueOrThrow({
    where: { id: input.listingId },
    include: { sellerBusiness: true, reports: { where: { status: "ACTIONED" } } },
  });

  const statement = statementOfReasons({
    title: listing.title,
    ground: input.ground,
    facts: input.facts,
    termsSection: input.termsSection,
    triggeredByReport: Boolean(input.reportId),
  });
  await notify(
    listing.sellerBusinessId,
    "LISTING_MODERATED",
    "Listing removed",
    `"${listing.title}" was removed: ${input.facts}`,
    `/listings/${listing.id}`
  );
  await sendEmail(
    listing.sellerBusiness.contactEmail,
    `Your listing "${listing.title}" was removed`,
    emailShell("Your listing was removed", statement.map((l) => `<p>${escapeHtml(l)}</p>`).join(""))
  );

  // Tell every reporter the outcome (Art. 16(5)).
  for (const r of listing.reports) {
    await sendEmail(
      r.reporterEmail,
      "Outcome of your report",
      emailShell(
        "We removed the listing you reported",
        `<p>Thank you. After review we removed the listing "${escapeHtml(listing.title)}".</p>`
      )
    );
  }
  return true;
}

/** Close a report with no action and tell the reporter why. */
export async function dismissReport(reportId: string, note: string): Promise<boolean> {
  const claim = await prisma.listingReport.updateMany({
    where: { id: reportId, status: "OPEN" },
    data: { status: "DISMISSED", decidedAt: new Date(), decisionNote: note },
  });
  if (claim.count === 0) return false;
  const report = await prisma.listingReport.findUniqueOrThrow({ where: { id: reportId }, include: { listing: true } });
  await sendEmail(
    report.reporterEmail,
    "Outcome of your report",
    emailShell(
      "We reviewed the listing you reported",
      `<p>After review we did not remove "${escapeHtml(report.listing.title)}".</p><p>Reason: ${escapeHtml(note)}</p>` +
        `<p>If you have more information, you can report it again or reply to this email.</p>`
    )
  );
  return true;
}

/** The Art. 17 text shown to the seller, in the email and on the listing page. */
export function statementOfReasons(d: {
  title: string;
  ground: ModerationGround;
  facts: string;
  termsSection?: string | null;
  triggeredByReport: boolean;
}): string[] {
  return [
    `What we did: removed your listing "${d.title}". It is no longer visible to other users and its open offers were withdrawn. Orders already placed are not affected.`,
    `Why: ${d.facts}`,
    `Ground: ${GROUND_LABELS[d.ground]}${d.termsSection ? ` (${d.termsSection})` : ""}.`,
    `How it was decided: ${d.triggeredByReport ? "after a report from another user, " : ""}reviewed and decided by a person, not by an automated system.`,
    REDRESS,
  ];
}
