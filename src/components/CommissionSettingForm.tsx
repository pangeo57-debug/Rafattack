"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ui } from "@/lib/ui";

export default function CommissionSettingForm({ current }: { current: number }) {
  const router = useRouter();
  const [value, setValue] = useState(current);
  const [loading, setLoading] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save() {
    setLoading(true);
    setError(null);
    setSaved(false);
    const res = await fetch("/api/admin/settings", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ commissionPercent: value }),
    });
    setLoading(false);
    if (!res.ok) {
      const json = await res.json();
      setError(json.error ?? "Could not save.");
      return;
    }
    setSaved(true);
    router.refresh();
  }

  return (
    <div className={`${ui.card} max-w-sm p-4`}>
      <label className={ui.label}>Platform commission (%)</label>
      <input
        type="number"
        min={0}
        max={100}
        step="0.1"
        value={value}
        onChange={(e) => setValue(Number(e.target.value))}
        className={ui.input}
      />
      <p className="mt-1 text-xs text-zinc-500">
        Applied to new offers accepted after this change. Existing orders keep their original rate.
      </p>
      {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
      {saved && <p className="mt-2 text-sm text-emerald-700">Saved.</p>}
      <button onClick={save} disabled={loading} className={`${ui.btnPrimary} mt-3`}>
        {loading ? "Saving..." : "Save"}
      </button>
    </div>
  );
}
