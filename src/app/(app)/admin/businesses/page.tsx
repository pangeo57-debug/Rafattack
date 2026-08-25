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
      <h1 className="text-2xl font-semibold text-zinc-900">Businesses</h1>
      <div className="mt-6 space-y-3">
        {businesses.map((b) => {
          const documents: string[] = JSON.parse(b.verificationDocuments || "[]");
          return (
            <div key={b.id} className={`${ui.card} flex flex-wrap items-center justify-between gap-3 p-4`}>
              <div>
                <div className="flex items-center gap-2">
                  <Link href={`/businesses/${b.id}`} className="font-medium text-zinc-900 hover:underline">
                    {b.name}
                  </Link>
                  <span className={`${ui.badge} ${badgeColor(b.verificationStatus)}`}>
                    {b.verificationStatus}
                  </span>
                </div>
                <p className="mt-1 text-sm text-zinc-500">
                  {b.type} &middot; {b.category} &middot; {b.city}, {b.country} &middot; {b.contactEmail}
                </p>
                <p className="text-xs text-zinc-400">Tax ID: {b.taxId}</p>
                {documents.length > 0 ? (
                  <div className="mt-2 flex gap-2">
                    {documents.map((doc, i) => (
                      <a key={i} href={doc} target="_blank" rel="noopener noreferrer">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={doc}
                          alt="Verification document"
                          className="h-16 w-16 rounded-md border border-zinc-200 object-cover"
                        />
                      </a>
                    ))}
                  </div>
                ) : (
                  <p className="mt-2 text-xs text-amber-600">No verification documents uploaded yet.</p>
                )}
              </div>
              <BusinessVerificationActions businessId={b.id} />
            </div>
          );
        })}
      </div>
    </div>
  );
}
