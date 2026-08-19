import Link from "next/link";
import { requireAdmin } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { ui, badgeColor } from "@/lib/ui";
import BusinessVerificationActions from "@/components/BusinessVerificationActions";

export default async function AdminBusinessesPage() {
  await requireAdmin();
  const businesses = await prisma.business.findMany({ orderBy: { createdAt: "desc" } });

  return (
    <div className="mx-auto max-w-5xl px-4 py-10 sm:px-6">
      <h1 className="text-2xl font-semibold text-slate-900">Businesses</h1>
      <div className="mt-6 space-y-3">
        {businesses.map((b) => (
          <div key={b.id} className={`${ui.card} flex flex-wrap items-center justify-between gap-3 p-4`}>
            <div>
              <div className="flex items-center gap-2">
                <Link href={`/businesses/${b.id}`} className="font-medium text-slate-900 hover:underline">
                  {b.name}
                </Link>
                <span className={`${ui.badge} ${badgeColor(b.verificationStatus)}`}>
                  {b.verificationStatus}
                </span>
              </div>
              <p className="mt-1 text-sm text-slate-500">
                {b.type} &middot; {b.category} &middot; {b.city}, {b.country} &middot; {b.contactEmail}
              </p>
              <p className="text-xs text-slate-400">Tax ID: {b.taxId}</p>
            </div>
            <BusinessVerificationActions businessId={b.id} />
          </div>
        ))}
      </div>
    </div>
  );
}
