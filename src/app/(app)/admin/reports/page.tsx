import Link from "next/link";
import { requireAdmin } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { ui, formatDate } from "@/lib/ui";
import { REPORT_REASONS } from "@/lib/constants";
import ReportDecision from "@/components/ReportDecision";

export default async function AdminReportsPage() {
  await requireAdmin();
  const reports = await prisma.listingReport.findMany({
    where: { status: "OPEN" },
    include: { listing: { include: { sellerBusiness: true } } },
    orderBy: { createdAt: "asc" },
    take: 100,
  });

  return (
    <div className="mx-auto max-w-4xl px-4 py-10 sm:px-6">
      <h1 className="text-2xl font-semibold text-zinc-900">Listing reports</h1>
      <p className="mt-1 text-sm text-zinc-500">
        Oldest first. Removing a listing sends the seller a statement of reasons; either decision emails the reporter.
      </p>
      <div className="mt-6 space-y-4">
        {reports.length === 0 && <p className="text-zinc-500">No open reports.</p>}
        {reports.map((r) => (
          <div key={r.id} className={`${ui.card} p-4`}>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <Link href={`/listings/${r.listingId}`} className="font-medium text-zinc-900 hover:underline">
                {r.listing.title}
              </Link>
              <p className="text-sm text-zinc-500">{formatDate(r.createdAt)}</p>
            </div>
            <p className="mt-1 text-sm text-zinc-500">
              Seller: {r.listing.sellerBusiness.name} &middot; Reported by {r.reporterName} ({r.reporterEmail})
            </p>
            <p className="mt-2 text-sm font-medium text-rose-700">
              {REPORT_REASONS.find((x) => x.value === r.reason)?.label ?? r.reason}
            </p>
            <p className="mt-1 whitespace-pre-wrap rounded-md bg-zinc-50 px-3 py-2 text-sm text-zinc-700">{r.explanation}</p>
            <ReportDecision reportId={r.id} />
          </div>
        ))}
      </div>
    </div>
  );
}
