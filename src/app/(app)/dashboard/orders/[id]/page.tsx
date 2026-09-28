import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { notFound } from "next/navigation";
import { requireBusiness } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { findTransactionAsParty } from "@/lib/access";
import { buyerBillingForSeller } from "@/lib/invoicing";
import { deadlineFor } from "@/lib/order-timers";
import { ui, badgeColor, formatMoney, formatDate, formatDateTime } from "@/lib/ui";
import { ORDER_STATUS_LABELS } from "@/lib/constants";
import PayButton from "@/components/PayButton";
import OrderActions from "@/components/OrderActions";
import OrderStepper from "@/components/OrderStepper";
import ReviewForm from "@/components/ReviewForm";
import OrderMessageForm from "@/components/OrderMessageForm";

export default async function OrderDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { business } = await requireBusiness();
  const { id } = await params;

  const access = await findTransactionAsParty(id, business.id);
  if (!access) notFound();
  const { isSeller, isBuyer } = access;

  const transaction = await prisma.transaction.findUniqueOrThrow({
    where: { id },
    include: {
      listing: true,
      sellerBusiness: true,
      buyerBusiness: true,
      reviews: true,
      messages: { orderBy: { createdAt: "asc" } },
    },
  });

  const role = isSeller ? "seller" : "buyer";
  const myReview = transaction.reviews.find((r) => r.reviewerBusinessId === business.id);
  const otherParty = isSeller ? transaction.buyerBusiness : transaction.sellerBusiness;
  const billing = buyerBillingForSeller(transaction, isSeller);
  const deadline = deadlineFor(transaction);
  const deadlineText = deadline && deadlineMessage(deadline.kind, formatDateTime(deadline.at), isSeller);

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

      {deadlineText && (
        <div className="mt-4 rounded-xl border border-sky-200 bg-sky-50 px-4 py-3 text-sm text-sky-800" data-testid="deadline">
          {deadlineText}
        </div>
      )}

      {billing && (
        <div className={`${ui.card} mt-4 p-4`} data-testid="buyer-billing">
          <h2 className="text-sm font-medium text-zinc-900">Buyer&apos;s invoice details</h2>
          <p className="mt-1 text-xs text-zinc-500">
            You issue the invoice for this sale to the buyer. Surplo does not issue it for you.
          </p>
          <dl className="mt-3 grid grid-cols-1 gap-2 text-sm sm:grid-cols-2">
            <div>
              <dt className="text-zinc-400">Business name</dt>
              <dd className="text-zinc-800">{billing.name}</dd>
            </div>
            <div>
              <dt className="text-zinc-400">Tax / VAT ID</dt>
              <dd className="text-zinc-800">{billing.taxId}</dd>
            </div>
            <div>
              <dt className="text-zinc-400">Address</dt>
              <dd className="text-zinc-800">
                {billing.address ? (
                  `${billing.address}, ${billing.city}, ${billing.country}`
                ) : (
                  <>
                    {billing.city}, {billing.country}
                    <span className="block text-xs text-amber-700">
                      No street address on file. Ask the buyer before invoicing.
                    </span>
                  </>
                )}
              </dd>
            </div>
            <div>
              <dt className="text-zinc-400">Email</dt>
              <dd className="text-zinc-800">{billing.contactEmail}</dd>
            </div>
          </dl>
        </div>
      )}

      {isSeller && !transaction.paidAt && transaction.orderStatus === "AWAITING_PAYMENT" && (
        <p className="mt-4 text-sm text-zinc-500">The buyer&apos;s invoice details will appear here once the order is paid.</p>
      )}

      {isBuyer && !transaction.buyerBusiness.address && transaction.orderStatus !== "CANCELLED" && (
        <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          The seller will invoice you using your business details. Your street address is missing:{" "}
          <Link href="/dashboard/business" className="font-medium underline">
            add it in your business profile
          </Link>
          .
        </div>
      )}

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

      {transaction.carrier && (
        <div className={`${ui.card} mt-4 p-4 text-sm`} data-testid="shipment">
          <p className="font-medium text-zinc-900">Shipment</p>
          <p className="mt-1 text-zinc-700">
            {transaction.carrier}
            {transaction.trackingNumber ? ` · tracking ${transaction.trackingNumber}` : " · no tracking number given"}
          </p>
        </div>
      )}

      <div id="messages" className={`${ui.card} mt-6 p-4`}>
        <h2 className="text-sm font-medium text-zinc-900">Messages with the {isSeller ? "buyer" : "seller"}</h2>
        {transaction.messages.length === 0 ? (
          <p className="mt-2 text-sm text-zinc-500">No messages yet.</p>
        ) : (
          <ul className="mt-3 space-y-2" data-testid="messages">
            {transaction.messages.map((m) => {
              const mine = m.senderBusinessId === business.id;
              return (
                <li key={m.id} className={`max-w-[85%] rounded-lg px-3 py-2 text-sm ${mine ? "ml-auto bg-brand/10 text-zinc-900" : "bg-zinc-100 text-zinc-800"}`}>
                  <p className="whitespace-pre-wrap break-words">{m.body}</p>
                  <p className="mt-1 text-[11px] text-zinc-500">
                    {mine ? "You" : isSeller ? "Buyer" : "Seller"} · {formatDateTime(m.createdAt)}
                  </p>
                </li>
              );
            })}
          </ul>
        )}
        <OrderMessageForm transactionId={transaction.id} otherParty={isSeller ? "buyer" : "seller"} />
      </div>

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

function deadlineMessage(kind: "PAY" | "SHIP" | "CONFIRM", at: string, isSeller: boolean) {
  switch (kind) {
    case "PAY":
      return isSeller
        ? `If the buyer doesn't pay by ${at}, the order is cancelled automatically and the units go back on your listing.`
        : `Please pay by ${at}. After that the order is cancelled automatically.`;
    case "SHIP":
      return isSeller
        ? `Mark this order as shipped or picked up by ${at}. Otherwise the buyer is refunded in full automatically.`
        : `If the seller hasn't shipped by ${at}, you are refunded in full automatically.`;
    case "CONFIRM":
      return isSeller
        ? `Your payout is released when the buyer confirms receipt, or automatically on ${at} if they don't report a problem.`
        : `Check the goods. If something is wrong, report a problem before ${at}. After that, payment is released to the seller automatically.`;
  }
}
