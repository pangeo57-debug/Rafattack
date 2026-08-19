import { notFound } from "next/navigation";
import { requireBusiness } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import ListingForm from "@/components/ListingForm";

export default async function EditListingPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { business } = await requireBusiness();
  const { id } = await params;
  const listing = await prisma.listing.findUnique({ where: { id } });
  if (!listing || listing.sellerBusinessId !== business.id) notFound();

  return (
    <div className="mx-auto max-w-2xl px-4 py-10 sm:px-6">
      <h1 className="text-2xl font-semibold text-slate-900">Edit listing</h1>
      <div className="mt-6 rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
        <ListingForm listing={listing} />
      </div>
    </div>
  );
}
