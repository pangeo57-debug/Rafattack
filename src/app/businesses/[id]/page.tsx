import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { ui, badgeColor, formatMoney, formatDate } from "@/lib/ui";

export default async function BusinessProfilePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const business = await prisma.business.findUnique({ where: { id } });
  if (!business) notFound();

  const [listings, reviews, reviewAgg] = await Promise.all([
    prisma.listing.findMany({
      where: { sellerBusinessId: id, status: "ACTIVE" },
      orderBy: { createdAt: "desc" },
      take: 12,
    }),
    prisma.review.findMany({
      where: { revieweeBusinessId: id },
      include: { reviewerBusiness: true },
      orderBy: { createdAt: "desc" },
      take: 10,
    }),
    prisma.review.aggregate({
      where: { revieweeBusinessId: id },
      _avg: { rating: true },
      _count: true,
    }),
  ]);

  return (
    <div className="mx-auto max-w-5xl px-4 py-10 sm:px-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">{business.name}</h1>
          <div className="mt-1 flex items-center gap-2 text-sm text-slate-500">
            <span className={`${ui.badge} ${badgeColor(business.verificationStatus)}`}>
              {business.verificationStatus}
            </span>
            <span>{business.type}</span>
            <span>&middot;</span>
            <span>
              {business.city}, {business.country}
            </span>
          </div>
        </div>
        {reviewAgg._count > 0 && (
          <p className="text-lg font-medium text-slate-900">
            {reviewAgg._avg.rating?.toFixed(1)} ★{" "}
            <span className="text-sm font-normal text-slate-500">
              ({reviewAgg._count} reviews)
            </span>
          </p>
        )}
      </div>

      <section className="mt-8">
        <h2 className="text-lg font-semibold text-slate-900">Active listings</h2>
        {listings.length === 0 ? (
          <p className="mt-2 text-sm text-slate-500">No active listings right now.</p>
        ) : (
          <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {listings.map((l) => (
              <Link
                key={l.id}
                href={`/listings/${l.id}`}
                className={`${ui.card} block p-4 hover:border-indigo-300`}
              >
                <h3 className="font-medium text-slate-900">{l.title}</h3>
                <p className="mt-1 text-sm font-semibold text-slate-900">
                  {formatMoney(l.askingPrice)} / {l.unit === "ITEM" ? "item" : "lot"}
                </p>
              </Link>
            ))}
          </div>
        )}
      </section>

      <section className="mt-8">
        <h2 className="text-lg font-semibold text-slate-900">Reviews</h2>
        {reviews.length === 0 ? (
          <p className="mt-2 text-sm text-slate-500">No reviews yet.</p>
        ) : (
          <ul className="mt-4 space-y-4">
            {reviews.map((r) => (
              <li key={r.id} className={`${ui.card} p-4`}>
                <div className="flex items-center justify-between">
                  <p className="font-medium text-slate-900">{r.reviewerBusiness.name}</p>
                  <p className="text-sm text-slate-500">{formatDate(r.createdAt)}</p>
                </div>
                <p className="mt-1 text-amber-500">{"★".repeat(r.rating)}{"☆".repeat(5 - r.rating)}</p>
                {r.comment && <p className="mt-1 text-sm text-slate-700">{r.comment}</p>}
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
