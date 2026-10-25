"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ui } from "@/lib/ui";

export default function BuyRequestActions({ id, status }: { id: string; status: string }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function act(action: "PAUSE" | "RESUME" | "CANCEL") {
    if (action === "CANCEL" && !window.confirm("Cancel this buy request? This can't be undone.")) return;
    setLoading(true);
    setError(null);
    const res = await fetch(`/api/bids/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action }),
    });
    setLoading(false);
    if (!res.ok) {
      const json = await res.json().catch(() => ({}));
      setError(json.error ?? "Something went wrong.");
      return;
    }
    router.refresh();
  }

  if (status !== "ACTIVE" && status !== "PAUSED") return null;
  return (
    <div className="flex flex-wrap items-center gap-2">
      {status === "ACTIVE" && (
        <button disabled={loading} onClick={() => act("PAUSE")} className={ui.btnSecondary}>Pause</button>
      )}
      {status === "PAUSED" && (
        <button disabled={loading} onClick={() => act("RESUME")} className={ui.btnPrimary}>Resume</button>
      )}
      <button disabled={loading} onClick={() => act("CANCEL")} className={ui.btnDanger}>Cancel</button>
      {error && <p className="w-full text-sm text-rose-600" role="alert">{error}</p>}
    </div>
  );
}
