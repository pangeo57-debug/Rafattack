"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ui } from "@/lib/ui";
import { formatCents } from "@/lib/money";

export default function SellToBuyer({
  buyOrderId,
  listingId,
  unitPriceCents,
  minQty,
  maxQty,
}: {
  buyOrderId: string;
  listingId: string;
  unitPriceCents: number;
  minQty: number;
  maxQty: number;
}) {
  const router = useRouter();
  const [qty, setQty] = useState(maxQty);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const valid = Number.isInteger(qty) && qty >= minQty && qty <= maxQty;

  async function sell() {
    if (!window.confirm(`Sell ${qty} units at ${formatCents(unitPriceCents)} each (${formatCents(unitPriceCents * qty)})? The buyer then has 48 hours to pay.`)) return;
    setLoading(true);
    setError(null);
    const res = await fetch(`/api/bids/${buyOrderId}/fill`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ listingId, quantity: qty }),
    });
    const json = await res.json().catch(() => ({}));
    setLoading(false);
    if (!res.ok) {
      setError(json.error ?? "Could not complete the sale.");
      router.refresh();
      return;
    }
    router.push(`/dashboard/orders/${json.transaction.id}`);
  }

  return (
    <div className="mt-2 flex flex-wrap items-end gap-2">
      {minQty < maxQty && (
        <label className="text-xs text-zinc-500">
          Units
          <input
            type="number"
            min={minQty}
            max={maxQty}
            value={qty}
            onChange={(e) => setQty(Number(e.target.value))}
            className={`${ui.input} w-24`}
          />
        </label>
      )}
      <button disabled={loading || !valid} onClick={sell} className={ui.btnPrimary}>
        {loading ? "Selling..." : `Sell ${valid ? qty : ""} for ${valid ? formatCents(unitPriceCents * qty) : "…"}`}
      </button>
      {error && <p className="w-full text-sm text-rose-600" role="alert">{error}</p>}
    </div>
  );
}
