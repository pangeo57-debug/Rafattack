import { requireBusiness } from "@/lib/session";
import ListingForm from "@/components/ListingForm";

export default async function NewListingPage() {
  await requireBusiness();
  return (
    <div className="mx-auto max-w-2xl px-4 py-10 sm:px-6">
      <h1 className="text-2xl font-semibold text-slate-900">List inventory</h1>
      <p className="mt-1 text-sm text-slate-600">
        Post your excess or overstock inventory for other businesses to buy.
      </p>
      <div className="mt-6 rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
        <ListingForm />
      </div>
    </div>
  );
}
