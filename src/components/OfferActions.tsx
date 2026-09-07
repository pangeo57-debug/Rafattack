"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ui } from "@/lib/ui";

export default function OfferActions({
  offerId,
  role,
  status,
}: {
  offerId: string;
  role: "seller" | "buyer";
  status: string;
}) {
  const router = useRouter();
  const [loading, setLoading] = useState<string | null>(null);
  const [countering, setCountering] = useState(false);
  const [counterPrice, setCounterPrice] = useState("");
  const [counterQuantity, setCounterQuantity] = useState("");
  const [error, setError] = useState<string | null>(null);

  async function act(action: string, extra?: Record<string, unknown>) {
    setLoading(action);
    setError(null);
    const res = await fetch(`/api/offers/${offerId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action, ...extra }),
    });
    const json = await res.json();
    setLoading(null);
    if (!res.ok) {
      setError(json.error ?? "Could not update offer.");
      return;
    }
    if (json.transaction) {
      router.push(`/dashboard/orders/${json.transaction.id}`);
      return;
    }
    router.refresh();
  }

  if (role === "seller" && status === "PENDING") {
    return (
      <div>
        {error && <p className="mb-2 text-sm text-red-600">{error}</p>}
        {countering ? (
          <div className="flex flex-wrap items-end gap-2">
            <div>
              <label className="block text-xs text-zinc-500">Counter price</label>
              <input
                type="number"
                step="0.01"
                value={counterPrice}
                onChange={(e) => setCounterPrice(e.target.value)}
                className={`${ui.input} w-28`}
              />
            </div>
            <div>
              <label className="block text-xs text-zinc-500">Counter qty</label>
              <input
                type="number"
                value={counterQuantity}
                onChange={(e) => setCounterQuantity(e.target.value)}
                className={`${ui.input} w-24`}
              />
            </div>
            <button
              disabled={loading !== null}
              onClick={() =>
                act("COUNTER", {
                  counterPrice: Number(counterPrice),
                  counterQuantity: Number(counterQuantity),
                })
              }
              className={ui.btnPrimary}
            >
              Send counter
            </button>
            <button onClick={() => setCountering(false)} className={ui.btnSecondary}>
              Cancel
            </button>
          </div>
        ) : (
          <div className="flex gap-2">
            <button disabled={loading !== null} onClick={() => act("ACCEPT")} className={ui.btnPrimary}>
              {loading === "ACCEPT" ? "Accepting..." : "Accept"}
            </button>
            <button onClick={() => setCountering(true)} className={ui.btnSecondary}>
              Counter
            </button>
            <button disabled={loading !== null} onClick={() => act("REJECT")} className={ui.btnDanger}>
              Reject
            </button>
          </div>
        )}
      </div>
    );
  }

  if (role === "buyer" && status === "PENDING") {
    return (
      <div>
        {error && <p className="mb-2 text-sm text-red-600">{error}</p>}
        <button disabled={loading !== null} onClick={() => act("WITHDRAW")} className={ui.btnSecondary}>
          Withdraw offer
        </button>
      </div>
    );
  }

  if (role === "buyer" && status === "COUNTERED") {
    return (
      <div>
        {error && <p className="mb-2 text-sm text-red-600">{error}</p>}
        <div className="flex gap-2">
          <button disabled={loading !== null} onClick={() => act("ACCEPT")} className={ui.btnPrimary}>
            {loading === "ACCEPT" ? "Accepting..." : "Accept counter"}
          </button>
          <button disabled={loading !== null} onClick={() => act("REJECT")} className={ui.btnDanger}>
            Reject
          </button>
        </div>
      </div>
    );
  }

  return null;
}
