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
        <button key="ship" disabled={loading !== null} onClick={() => act("SHIP")} className={ui.btnPrimary}>
          Mark as shipped
        </button>
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
      <button key="complete" disabled={loading !== null} onClick={() => act("COMPLETE")} className={ui.btnPrimary}>
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
                <label className="block text-xs text-slate-500">Reason for dispute</label>
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
