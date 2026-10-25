"use client";

import { useState } from "react";
import { Flag } from "lucide-react";
import { ui } from "@/lib/ui";
import { REPORT_REASONS } from "@/lib/constants";

export default function ReportListing({ listingId }: { listingId: string }) {
  const [open, setOpen] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    const f = new FormData(e.currentTarget);
    const res = await fetch(`/api/listings/${listingId}/report`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        reason: f.get("reason"),
        explanation: f.get("explanation"),
        name: f.get("name"),
        email: f.get("email"),
        goodFaith: f.get("goodFaith") === "on",
      }),
    });
    setLoading(false);
    if (res.ok) {
      setSent(true);
      return;
    }
    const json = await res.json().catch(() => ({}));
    setError(json.error ?? "Something went wrong. Please try again.");
  }

  if (sent) {
    return (
      <p className="rounded-lg bg-zinc-50 px-3 py-2 text-sm text-zinc-600" role="status">
        Thank you. We sent you a confirmation email, and a person will review the listing and email you the outcome.
      </p>
    );
  }

  if (!open) {
    return (
      <button onClick={() => setOpen(true)} className="flex items-center gap-1.5 text-sm text-zinc-500 hover:text-rose-600">
        <Flag className="h-3.5 w-3.5" />
        Report this listing
      </button>
    );
  }

  return (
    <form onSubmit={submit} className={`${ui.card} space-y-3 p-4`}>
      <p className="text-sm font-medium text-zinc-900">Report this listing</p>
      <p className="text-xs text-zinc-500">
        Tell us if this listing is illegal or breaks our Terms. A person reviews every report. The seller is not told who reported it.
      </p>
      <label className="block text-sm">
        <span className="text-zinc-700">What is wrong?</span>
        <select name="reason" required className={ui.input} defaultValue="">
          <option value="" disabled>Choose a reason</option>
          {REPORT_REASONS.map((r) => (
            <option key={r.value} value={r.value}>{r.label}</option>
          ))}
        </select>
      </label>
      <label className="block text-sm">
        <span className="text-zinc-700">Explain why (be specific: what law or rule, what in the listing)</span>
        <textarea name="explanation" required minLength={20} maxLength={3000} rows={4} className={ui.input} />
      </label>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <label className="block text-sm">
          <span className="text-zinc-700">Your name</span>
          <input name="name" required className={ui.input} autoComplete="name" />
        </label>
        <label className="block text-sm">
          <span className="text-zinc-700">Your email (for the outcome)</span>
          <input name="email" type="email" required className={ui.input} autoComplete="email" />
        </label>
      </div>
      <label className="flex items-start gap-2 text-xs text-zinc-600">
        <input name="goodFaith" type="checkbox" required className="mt-0.5" />
        I confirm this report is accurate and complete to the best of my knowledge, and made in good faith.
      </label>
      {error && <p className="text-sm text-rose-600" role="alert">{error}</p>}
      <div className="flex gap-2">
        <button type="submit" disabled={loading} className={ui.btnDanger}>
          {loading ? "Sending..." : "Send report"}
        </button>
        <button type="button" onClick={() => setOpen(false)} className={ui.btnSecondary}>
          Cancel
        </button>
      </div>
    </form>
  );
}
