import { requireBusiness } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { ui } from "@/lib/ui";
import SavedSearchForm from "@/components/SavedSearchForm";
import DeleteSavedSearchButton from "@/components/DeleteSavedSearchButton";

export default async function SavedSearchesPage() {
  const { business } = await requireBusiness();
  const searches = await prisma.savedSearch.findMany({
    where: { businessId: business.id },
    orderBy: { createdAt: "desc" },
  });

  return (
    <div className="mx-auto max-w-3xl px-4 py-10 sm:px-6">
      <h1 className="text-2xl font-semibold text-slate-900">Saved searches</h1>
      <p className="mt-1 text-sm text-slate-600">
        We&apos;ll notify you when a new listing matches any of these.
      </p>

      <div className="mt-6">
        <SavedSearchForm />
      </div>

      <div className="mt-6 space-y-2">
        {searches.length === 0 && <p className="text-slate-500">No saved searches yet.</p>}
        {searches.map((s) => (
          <div key={s.id} className={`${ui.card} flex items-center justify-between p-4`}>
            <p className="text-sm text-slate-700">
              {[s.keyword, s.category, s.location, s.minPrice ? `min $${s.minPrice}` : null, s.maxPrice ? `max $${s.maxPrice}` : null]
                .filter(Boolean)
                .join(" · ") || "Any listing"}
            </p>
            <DeleteSavedSearchButton id={s.id} />
          </div>
        ))}
      </div>
    </div>
  );
}
