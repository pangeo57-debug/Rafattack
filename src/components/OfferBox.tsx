"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ui } from "@/lib/ui";
import { formatCents, parseEuroToCents } from "@/lib/money";

export default function OfferBox({
  listingId,
  askingPriceCents,
  minOrderQty,
  quantityAvailable,
}: {
  listingId: string;
  askingPriceCents: number;
  minOrderQty: number;
  quantityAvailable: number;
}) {
  const router = useRouter();
  const [quantity, setQuantity] = useState(minOrderQty);
  // Kept as the text the buyer typed; the server turns it into cents.
  const [offeredPrice, setOfferedPrice] = useState((askingPriceCents / 100).toFixed(2));
  const offeredCents = parseEuroToCents(offeredPrice);
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState<"buy" | "offer" | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function submit(buyNow: boolean) {
    setError(null);
    setLoading(buyNow ? "buy" : "offer");
    const res = await fetch("/api/offers", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        listingId,
        // Buy now: the server charges the listing's own price whatever is sent here.
        offeredPrice: buyNow ? (askingPriceCents / 100).toFixed(2) : offeredPrice,
        quantity,
        message,
        buyNow,
      }),
    });
    const json = await res.json();
    setLoading(null);
    if (!res.ok) {
      setError(json.error ?? "Could not submit.");
      return;
    }
    if (buyNow && json.transaction) {
      router.push(`/dashboard/orders/${json.transaction.id}`);
    } else {
      router.push("/dashboard/offers?role=made");
    }
  }


  return (
    <div className={`${ui.card} p-4`}>
      {error && <div className="mb-3 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>}
      <div>
        <label className={ui.label}>Quantity</label>
        <input
          type="number"
          min={minOrderQty}
          max={quantityAvailable}
          value={quantity}
          onChange={(e) => setQuantity(Number(e.target.value))}
          className={ui.input}
        />
      </div>
      <div className="mt-3">
        <label className={ui.label}>Your offer price (per unit)</label>
        <input
          inputMode="decimal"
          value={offeredPrice}
          onChange={(e) => setOfferedPrice(e.target.value)}
          className={ui.input}
        />
      </div>
      <div className="mt-3">
        <label className={ui.label}>Message (optional)</label>
        <textarea
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          rows={2}
          className={ui.input}
        />
      </div>
      <p className="mt-3 text-sm text-zinc-500">
        Offer total: <span className="font-medium text-zinc-900">{offeredCents !== null ? formatCents(offeredCents * (quantity || 0)) : "enter a price like 18.50"}</span>
      </p>
      <div className="mt-4 flex flex-col gap-2">
        <button
          type="button"
          disabled={loading !== null}
          onClick={() => submit(true)}
          className={ui.btnPrimary}
        >
          {loading === "buy" ? "Processing..." : `Buy now at ${formatCents(askingPriceCents)}/unit`}
        </button>
        <button
          type="button"
          disabled={loading !== null}
          onClick={() => submit(false)}
          className={ui.btnSecondary}
        >
          {loading === "offer" ? "Sending..." : "Send offer"}
        </button>
      </div>
    </div>
  );
}
