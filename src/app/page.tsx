import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { ui, formatMoney } from "@/lib/ui";

export default async function Home() {
  const listings = await prisma.listing.findMany({
    where: { status: "ACTIVE" },
    orderBy: { createdAt: "desc" },
    take: 6,
    include: { sellerBusiness: true },
  });

  return (
    <div>
      <section className="border-b border-slate-200 bg-white">
        <div className="mx-auto max-w-6xl px-4 py-20 sm:px-6">
          <div className="max-w-2xl">
            <h1 className="text-4xl font-semibold tracking-tight text-slate-900 sm:text-5xl">
              Turn overstock into cash.
            </h1>
            <p className="mt-4 text-lg text-slate-600">
              Overstock Trade connects retailers with excess inventory to resellers,
              outlets and liquidators who want it &mdash; with escrow-protected
              payments and a simple commission on every sale.
            </p>
            <div className="mt-8 flex gap-3">
              <Link href="/signup" className={ui.btnPrimary}>
                Create a free business account
              </Link>
              <Link href="/listings" className={ui.btnSecondary}>
                Browse inventory
              </Link>
            </div>
          </div>
          <dl className="mt-16 grid grid-cols-1 gap-8 sm:grid-cols-3">
            <div>
              <dt className="text-sm font-medium text-slate-500">1. List</dt>
              <dd className="mt-1 text-slate-700">
                Post your overstock, returns, or discontinued lines in minutes.
              </dd>
            </div>
            <div>
              <dt className="text-sm font-medium text-slate-500">2. Negotiate & pay</dt>
              <dd className="mt-1 text-slate-700">
                Buyers offer or buy at your asking price. Funds are held in escrow
                until the order is confirmed received.
              </dd>
            </div>
            <div>
              <dt className="text-sm font-medium text-slate-500">3. Get paid</dt>
              <dd className="mt-1 text-slate-700">
                We deduct a small commission and pay out the rest directly to you.
              </dd>
            </div>
          </dl>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 py-12 sm:px-6">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-semibold text-slate-900">Latest listings</h2>
          <Link href="/listings" className="text-sm font-medium text-indigo-600 hover:text-indigo-700">
            View all &rarr;
          </Link>
        </div>
        {listings.length === 0 ? (
          <p className="mt-6 text-slate-500">
            No listings yet &mdash; be the first to{" "}
            <Link href="/signup" className="text-indigo-600 hover:underline">
              list your overstock
            </Link>
            .
          </p>
        ) : (
          <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {listings.map((l) => (
              <Link
                key={l.id}
                href={`/listings/${l.id}`}
                className={`${ui.card} block p-4 hover:border-indigo-300`}
              >
                <p className="text-xs font-medium uppercase tracking-wide text-indigo-600">
                  {l.category}
                </p>
                <h3 className="mt-1 font-medium text-slate-900">{l.title}</h3>
                <p className="mt-1 text-sm text-slate-500">
                  {l.sellerBusiness.name} &middot; {l.locationCity}, {l.locationCountry}
                </p>
                <p className="mt-3 text-lg font-semibold text-slate-900">
                  {formatMoney(l.askingPrice)}
                  <span className="ml-1 text-sm font-normal text-slate-500">
                    / {l.unit === "ITEM" ? "item" : "lot"}
                  </span>
                </p>
              </Link>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
