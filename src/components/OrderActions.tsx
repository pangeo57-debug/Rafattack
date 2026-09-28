"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ui } from "@/lib/ui";

export default function OrderActions({
  transactionId,
  role,
  orderStatus,
  fulfillment,
}: {
  transactionId: string;
  role: "seller" | "buyer";
  orderStatus: string;
  fulfillment: string;
}) {
  const router = useRouter();
  const [loading, setLoading] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [disputing, setDisputing] = useState(false);
  const [reason, setReason] = useState("");
  const [shipping, setShipping] = useState(false);
  const [carrier, setCarrier] = useState("");
  const [trackingNumber, setTrackingNumber] = useState("");

  async function act(action: string, extra?: Record<string, unknown>) {
    setLoading(action);
    setError(null);
    const res = await fetch(`/api/transactions/${transactionId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action, ...extra }),
    });
    const json = await res.json();
    setLoading(null);
    if (!res.ok) {
      setError(json.error ?? "Could not update order.");
      return;
    }
    router.refresh();
  }

  const actions: React.ReactNode[] = [];

  if (role === "buyer" && orderStatus === "AWAITING_PAYMENT") {
    actions.push(
      <button key="cancel" disabled={loading !== null} onClick={() => act("CANCEL")} className={ui.btnSecondary}>
        Cancel order
      </button>
    );
  }

  if (role === "seller" && orderStatus === "PAID") {
    const canShip = fulfillment !== "PICKUP";
    const canPickup = fulfillment !== "SHIPPING";
    if (canShip) {
      actions.push(
        shipping ? (
          <form
            key="ship"
            className="flex w-full flex-wrap items-end gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              act("SHIP", { carrier, trackingNumber });
            }}
          >
            <label className="block text-xs text-zinc-500">
              Carrier
              <input
                list="carriers"
                required
                minLength={2}
                value={carrier}
                onChange={(e) => setCarrier(e.target.value)}
                placeholder="ACS, ELTA Courier, own delivery…"
                className={ui.input}
              />
              <datalist id="carriers">
                {["ACS", "ELTA Courier", "Speedex", "Geniki Taxydromiki", "DHL", "Box Now", "Own delivery"].map((c) => (
                  <option key={c} value={c} />
                ))}
              </datalist>
            </label>
            <label className="block text-xs text-zinc-500">
              Tracking number (if any)
              <input value={trackingNumber} onChange={(e) => setTrackingNumber(e.target.value)} className={ui.input} />
            </label>
            <button type="submit" disabled={loading !== null} className={ui.btnPrimary}>
              {loading === "SHIP" ? "Saving..." : "Confirm shipment"}
            </button>
            <button type="button" onClick={() => setShipping(false)} className={ui.btnSecondary}>
              Back
            </button>
          </form>
        ) : (
          <button key="ship" disabled={loading !== null} onClick={() => setShipping(true)} className={ui.btnPrimary}>
            Mark as shipped
          </button>
        )
      );
    }
    if (canPickup) {
      actions.push(
        <button
          key="pickup"
          disabled={loading !== null}
          onClick={() => act("MARK_PICKED_UP")}
          className={ui.btnPrimary}
        >
          Mark as picked up
        </button>
      );
    }
  }

  if (role === "buyer" && (orderStatus === "SHIPPED" || orderStatus === "PICKED_UP")) {
    actions.push(
      <button
        key="complete"
        disabled={loading !== null}
        onClick={() => {
          if (
            window.confirm(
              "This releases payment to the seller and can't be undone — all sales are final once you confirm. Only continue if you've checked the goods match the listing."
            )
          ) {
            act("COMPLETE");
          }
        }}
        className={ui.btnPrimary}
      >
        {loading === "COMPLETE" ? "Confirming..." : "Confirm receipt & release payment"}
      </button>
    );
  }

  const canDispute = ["PAID", "SHIPPED", "PICKED_UP"].includes(orderStatus);

  return (
    <div className="space-y-3">
      {error && <p className="text-sm text-red-600">{error}</p>}
      <div className="flex flex-wrap gap-2">{actions}</div>

      {canDispute && (
        <div>
          {disputing ? (
            <div className="flex flex-wrap items-end gap-2">
              <div className="flex-1">
                <label className="block text-xs text-zinc-500">Reason for dispute</label>
                <input
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  className={ui.input}
                />
              </div>
              <button
                disabled={loading !== null}
                onClick={() => act("DISPUTE", { reason })}
                className={ui.btnDanger}
              >
                Submit dispute
              </button>
              <button onClick={() => setDisputing(false)} className={ui.btnSecondary}>
                Cancel
              </button>
            </div>
          ) : (
            <button onClick={() => setDisputing(true)} className="text-sm text-red-600 hover:underline">
              Report a problem with this order
            </button>
          )}
        </div>
      )}
    </div>
  );
}
