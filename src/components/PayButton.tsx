"use client";

import { useState } from "react";
import { ui } from "@/lib/ui";

export default function PayButton({ transactionId }: { transactionId: string }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function pay() {
    setLoading(true);
    setError(null);
    const res = await fetch(`/api/checkout/${transactionId}`, { method: "POST" });
    const json = await res.json();
    if (!res.ok) {
      setError(json.error ?? "Could not start checkout.");
      setLoading(false);
      return;
    }
    window.location.href = json.url;
  }

  return (
    <div>
      <button onClick={pay} disabled={loading} className={ui.btnPrimary}>
        {loading ? "Redirecting to payment..." : "Pay now"}
      </button>
      {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
    </div>
  );
}
