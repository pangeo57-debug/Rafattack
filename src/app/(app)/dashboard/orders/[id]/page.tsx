import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { notFound } from "next/navigation";
import { requireBusiness } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { ui, badgeColor, formatMoney, formatDate } from "@/lib/ui";
import { ORDER_STATUS_LABELS } from "@/lib/constants";
import PayButton from "@/components/PayButton";
import OrderActions from "@/components/OrderActions";
import OrderStepper from "@/components/OrderStepper";
import ReviewForm from "@/components/ReviewForm";

export default async function OrderDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { business } = await requireBusiness();
  const { id } = await params;

  const transaction = await prisma.transaction.findUnique({
    where: { id },
    include: {
      listing: true,
      sellerBusiness: true,
      buyerBusiness: true,
      reviews: true,
    },
  });
  if (!transaction) notFound();

  const isSeller = transaction.sellerBusinessId === business.id;
  const isBuyer = transaction.buyerBusinessId === business.id;
  if (!isSeller && !isBuyer) notFound();

  const role = isSeller ? "seller" : "buyer";
  const myReview = transaction.reviews.find((r) => r.reviewerBusinessId === business.id);
  const otherParty = isSeller ? transaction.buyerBusiness : transaction.sellerBusiness;

  const timeline = [
    { label: "Order created", at: transaction.createdAt },
    { label: "Paid", at: transaction.paidAt },
    { label: "Shipped / picked up", at: transaction.shippedAt },
    { label: "Completed", at: transaction.completedAt },
    { label: "Cancelled", at: transaction.cancelledAt },
  ].filter((t) => t.at);

  return (
    <div className="mx-auto max-w-3xl px-4 py-10 sm:px-6">
      <Link href="/dashboard/orders" className="flex items-center gap-1 text-sm text-brand hover:underline">
        <ArrowLeft className="h-3.5 w-3.5" />
        All orders
      </Link>

      <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-2xl font-semibold text-zinc-900">Order #{transaction.id.slice(-8)}</h1>
        <span className={`${ui.badge} ${badgeColor(transaction.orderStatus)}`}>
          {ORDER_STATUS_LABELS[transaction.orderStatus] ?? transaction.orderStatus}
        </span>
      </div>

      <div className={`${ui.card} mt-6 p-5`}>
        <OrderStepper status={transaction.orderStatus} />
      </div>

      <div className={`${ui.card} mt-4 p-4`}>
        <Link href={`/listings/${transaction.listingId}`} className="font-medium text-zinc-900 hover:underline">
          {transaction.listing.title}
        </Link>
        <p className="mt-1 text-sm text-zinc-500">
          You are the {role} &middot; {isSeller ? "buyer" : "seller"}: {otherParty.name}
        </p>
        <dl className="mt-4 grid grid-cols-2 gap-3 text-sm sm:grid-cols-3">
          <div>
            <dt className="text-zinc-400">Quantity</dt>
            <dd className="text-zinc-800">{transaction.quantity}</dd>
          </div>
          <div>
            <dt className="text-zinc-400">Unit price</dt>
            <dd className="text-zinc-800">{formatMoney(transaction.unitPrice)}</dd>
          </div>
          <div>
            <dt className="text-zinc-400">Order total</dt>
            <dd className="text-zinc-800">{formatMoney(transaction.amount)}</dd>
          </div>
          <div>
            <dt className="text-zinc-400">Platform commission ({transaction.commissionRate}%)</dt>
            <dd className="text-zinc-800">{formatMoney(transaction.commissionAmount)}</dd>
          </div>
          <div>
            <dt className="text-zinc-400">Seller payout</dt>
            <dd className="text-zinc-800">{formatMoney(transaction.sellerPayoutAmount)}</dd>
          </div>
          <div>
            <dt className="text-zinc-400">Escrow status</dt>
            <dd className="text-zinc-800">{transaction.escrowStatus}</dd>
          </div>
        </dl>
      </div>

      {transaction.orderStatus === "AWAITING_PAYMENT" && isBuyer && (
        <div className="mt-4">
          <PayButton transactionId={transaction.id} />
        </div>
      )}

      {transaction.orderStatus === "DISPUTED" && (
        <div className="mt-4 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
          This order is under dispute{transaction.disputeReason ? `: ${transaction.disputeReason}` : ""}. Our
          team will review and resolve it.
        </div>
      )}

      {["AWAITING_PAYMENT", "PAID", "SHIPPED", "PICKED_UP"].includes(transaction.orderStatus) && (
        <div className="mt-4">
          <OrderActions
            transactionId={transaction.id}
            role={role}
            orderStatus={transaction.orderStatus}
            fulfillment={transaction.listing.fulfillment}
          />
        </div>
      )}

      {transaction.orderStatus === "COMPLETED" && !myReview && (
        <div className="mt-4">
          <ReviewForm transactionId={transaction.id} revieweeName={otherParty.name} />
        </div>
      )}

      {timeline.length > 0 && (
        <div className="mt-6">
          <h2 className="text-sm font-medium text-zinc-900">Timeline</h2>
          <ul className="mt-2 space-y-1 text-sm text-zinc-500">
            {timeline.map((t) => (
              <li key={t.label}>
                {t.label}: {formatDate(t.at as Date)}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
