"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ui } from "@/lib/ui";

export default function ReportDecision({ reportId }: { reportId: string }) {
  const router = useRouter();
  const [mode, setMode] = useState<"REMOVE" | "DISMISS" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    const body =
      mode === "REMOVE"
        ? { action: "REMOVE", ground: f.get("ground"), facts: f.get("text"), termsSection: f.get("termsSection") || undefined }
        : { action: "DISMISS", note: f.get("text") };
    setLoading(true);
    setError(null);
    const res = await fetch(`/api/admin/reports/${reportId}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    setLoading(false);
    if (!res.ok) {
      const json = await res.json().catch(() => ({}));
      setError(json.error ?? "Something went wrong.");
      return;
    }
    router.refresh();
  }

  if (!mode) {
    return (
      <div className="mt-3 flex gap-2">
        <button onClick={() => setMode("REMOVE")} className={ui.btnDanger}>Remove listing</button>
        <button onClick={() => setMode("DISMISS")} className={ui.btnSecondary}>Dismiss report</button>
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="mt-3 space-y-2">
      {mode === "REMOVE" && (
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          <label className="block text-sm">
            <span className="text-zinc-700">Ground</span>
            <select name="ground" className={ui.input} defaultValue="TERMS_VIOLATION">
              <option value="TERMS_VIOLATION">Breach of Terms</option>
              <option value="ILLEGAL_CONTENT">Illegal under the law</option>
            </select>
          </label>
          <label className="block text-sm">
            <span className="text-zinc-700">Terms section or law (optional)</span>
            <input name="termsSection" placeholder="e.g. Terms §3" className={ui.input} />
          </label>
        </div>
      )}
      <label className="block text-sm">
        <span className="text-zinc-700">
          {mode === "REMOVE" ? "Reason the seller will read (facts, specific)" : "Reason the reporter will read"}
        </span>
        <textarea name="text" required minLength={10} rows={3} className={ui.input} />
      </label>
      {error && <p className="text-sm text-rose-600" role="alert">{error}</p>}
      <div className="flex gap-2">
        <button type="submit" disabled={loading} className={mode === "REMOVE" ? ui.btnDanger : ui.btnPrimary}>
          {loading ? "Saving..." : mode === "REMOVE" ? "Remove and notify seller" : "Dismiss and notify reporter"}
        </button>
        <button type="button" onClick={() => setMode(null)} className={ui.btnSecondary}>Back</button>
      </div>
    </form>
  );
}
