import Link from "next/link";
import { Megaphone, PackagePlus, Wallet, ArrowRight } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { ui } from "@/lib/ui";
import ListingCard from "@/components/ListingCard";
import { formatCents } from "@/lib/money";
import { LISTING_CONDITIONS } from "@/lib/constants";

const steps = [
  {
    icon: Megaphone,
    title: "Buyers say what they'll pay",
    desc: "Verified businesses post standing buy requests: category, condition, quantity and the most they'll pay per unit.",
  },
  {
    icon: PackagePlus,
    title: "You list, and see who's waiting",
    desc: "Post your overstock and instantly see the buyers whose request matches. Sell to the best one in a single click, at their price.",
  },
  {
    icon: Wallet,
    title: "Escrow, then payout",
    desc: "The buyer's payment is held until they confirm receipt. We keep a small commission and pay out the rest.",
  },
];

export default async function Home() {
  const now = new Date();
  const openBuyRequests = { status: "ACTIVE" as const, expiresAt: { gt: now }, buyerBusiness: { verificationStatus: "VERIFIED" as const, deletedAt: null } };
  const [requests, requestCount] = await Promise.all([
    prisma.buyOrder.findMany({
      where: openBuyRequests,
      // Buyers stay anonymous here, as on /wanted.
      select: { id: true, category: true, conditions: true, maxUnitPriceCents: true, currency: true, remainingQty: true, minLotQty: true, country: true, city: true },
      orderBy: { createdAt: "desc" },
      take: 3,
    }),
    prisma.buyOrder.count({ where: openBuyRequests }),
  ]);
  const listings = await prisma.listing.findMany({
    where: { status: "ACTIVE" },
    orderBy: { createdAt: "desc" },
    take: 6,
    include: { sellerBusiness: true },
  });

  return (
    <div>
      <section className="relative overflow-hidden border-b border-zinc-200 bg-white">
        <div
          className="pointer-events-none absolute inset-0"
          style={{
            backgroundImage:
              "radial-gradient(circle at 1px 1px, rgb(0 0 0 / 0.05) 1px, transparent 0)",
            backgroundSize: "28px 28px",
            maskImage: "linear-gradient(to bottom, black, transparent 85%)",
          }}
        />
        <div
          className="pointer-events-none absolute -right-40 -top-40 h-[32rem] w-[32rem] rounded-full opacity-40 blur-3xl"
          style={{ background: "radial-gradient(circle, var(--brand) 0%, transparent 70%)" }}
        />

        <div className="relative mx-auto max-w-6xl px-4 py-20 sm:px-6 sm:py-28">
          <div className="max-w-2xl animate-in">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-brand-soft px-3 py-1 text-xs font-semibold text-brand">
              Buyers post what they want. You sell in one click.
            </span>
            <h1 className="mt-4 text-4xl font-semibold tracking-tight text-zinc-900 sm:text-6xl">
              Sell your overstock <br className="hidden sm:block" />
              to buyers already waiting.
            </h1>
            <p className="mt-5 text-lg text-zinc-600">
              Verified businesses post standing orders for the stock they
              need. List yours, see who&apos;s waiting, and sell at their
              price &mdash; with payment held in escrow until the goods arrive.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link href="/signup" className={`${ui.btnPrimary} px-5 py-2.5 text-base`}>
                Create a free business account
                <ArrowRight className="h-4 w-4" />
              </Link>
              <Link href="/wanted" className={`${ui.btnSecondary} px-5 py-2.5 text-base`}>
                See what buyers want
              </Link>
            </div>
          </div>

          <div className="mt-20 grid grid-cols-1 gap-6 sm:grid-cols-3">
            {steps.map((step, i) => (
              <div key={step.title} className="animate-in" style={{ animationDelay: `${i * 80}ms` }}>
                <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-soft text-brand">
                  <step.icon className="h-5 w-5" />
                </span>
                <p className="mt-3 text-sm font-semibold text-zinc-900">
                  {i + 1}. {step.title}
                </p>
                <p className="mt-1 text-sm leading-relaxed text-zinc-600">{step.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {requests.length > 0 && (
        <section className="mx-auto max-w-6xl px-4 pt-14 sm:px-6" data-testid="home-wanted">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-semibold text-zinc-900">
              Wanted right now <span className="text-sm font-normal text-zinc-500">· {requestCount} open request{requestCount === 1 ? "" : "s"}</span>
            </h2>
            <Link href="/wanted" className="flex items-center gap-1 text-sm font-medium text-brand hover:text-brand-hover">
              View all <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </div>
          <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {requests.map((r) => (
              <Link key={r.id} href="/wanted" className={`${ui.card} p-4 transition-shadow hover:shadow-md`}>
                <p className="text-xs font-medium uppercase tracking-wide text-brand">{r.category}</p>
                <p className="mt-1 text-lg font-semibold text-zinc-900">
                  up to {formatCents(r.maxUnitPriceCents, r.currency)}
                  <span className="text-sm font-normal text-zinc-500"> / unit</span>
                </p>
                <p className="mt-1 text-sm text-zinc-600">{r.remainingQty} units wanted · lots of {r.minLotQty}+</p>
                <p className="mt-1 text-sm text-zinc-500">
                  {r.conditions.map((c) => LISTING_CONDITIONS.find((x) => x.value === c)?.label ?? c).join(", ")} ·{" "}
                  {r.city ? `${r.city}, ${r.country}` : r.country}
                </p>
              </Link>
            ))}
          </div>
        </section>
      )}

      <section className="mx-auto max-w-6xl px-4 py-14 sm:px-6">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-semibold text-zinc-900">Latest listings</h2>
          <Link
            href="/listings"
            className="flex items-center gap-1 text-sm font-medium text-brand hover:text-brand-hover"
          >
            View all <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </div>
        {listings.length === 0 ? (
          <p className="mt-6 text-zinc-500">
            No listings yet &mdash; be the first to{" "}
            <Link href="/signup" className="text-brand hover:underline">
              list your overstock
            </Link>
            .
          </p>
        ) : (
          <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {listings.map((l) => (
              <ListingCard
                key={l.id}
                listing={{
                  id: l.id,
                  title: l.title,
                  category: l.category,
                  askingPriceCents: l.askingPriceCents,
                  originalPriceCents: l.originalPriceCents,
                  unit: l.unit,
                  locationCity: l.locationCity,
                  locationCountry: l.locationCountry,
                  sellerBusinessName: l.sellerBusiness.name,
                  sellerVerified: l.sellerBusiness.verificationStatus === "VERIFIED",
                }}
              />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
