"use client";

import { useState } from "react";
import { ui } from "@/lib/ui";

export default function ConnectStripeButton({ label }: { label: string }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onClick() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/stripe/connect", { method: "POST" });
      const json = await res.json();
      if (!res.ok) {
        setError(json.error ?? "Could not start Stripe onboarding.");
        setLoading(false);
        return;
      }
      window.location.href = json.url;
    } catch {
      setError("Could not start Stripe onboarding.");
      setLoading(false);
    }
  }

  return (
    <div>
      <button onClick={onClick} disabled={loading} className={ui.btnPrimary}>
        {loading ? "Redirecting..." : label}
      </button>
      {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
    </div>
  );
}
