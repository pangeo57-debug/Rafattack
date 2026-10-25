"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ui } from "@/lib/ui";

export default function DisputeResolutionActions({ transactionId }: { transactionId: string }) {
  const router = useRouter();
  const [note, setNote] = useState("");
  const [loading, setLoading] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function resolve(resolution: "SELLER" | "BUYER") {
    setLoading(resolution);
    setError(null);
    const res = await fetch(`/api/admin/disputes/${transactionId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ resolution, note }),
    });
    setLoading(null);
    if (!res.ok) {
      const json = await res.json();
      setError(json.error ?? "Could not resolve dispute.");
      return;
    }
    router.refresh();
  }

  return (
    <div className="mt-3 space-y-2">
      {error && <p className="text-sm text-red-600">{error}</p>}
      <textarea
        value={note}
        onChange={(e) => setNote(e.target.value)}
        placeholder="Resolution note (optional)"
        rows={2}
        className={ui.input}
      />
      <div className="flex gap-2">
        <button disabled={loading !== null} onClick={() => resolve("SELLER")} className={ui.btnPrimary}>
          Resolve for seller (release funds)
        </button>
        <button disabled={loading !== null} onClick={() => resolve("BUYER")} className={ui.btnDanger}>
          Resolve for buyer (refund)
        </button>
      </div>
    </div>
  );
}
