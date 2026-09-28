"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ui } from "@/lib/ui";
import { LISTING_CATEGORIES, LISTING_CONDITIONS } from "@/lib/constants";

export default function BuyRequestForm({ defaultCountry, defaultCity }: { defaultCountry: string; defaultCity: string }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [notified, setNotified] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const formEl = e.currentTarget;
    const f = new FormData(formEl);
    setLoading(true);
    setError(null);
    setNotified(null);
    const res = await fetch("/api/bids", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        category: f.get("category"),
        conditions: f.getAll("conditions"),
        maxUnitPrice: f.get("maxUnitPrice"),
        quantityWanted: f.get("quantityWanted"),
        minLotQty: f.get("minLotQty"),
        country: f.get("country"),
        city: f.get("city"),
        expiresInDays: f.get("expiresInDays"),
      }),
    });
    setLoading(false);
    const json = await res.json().catch(() => ({}));
    if (!res.ok) {
      setError(json.error ?? "Could not post your request.");
      return;
    }
    formEl.reset();
    setNotified("Posted. Sellers with matching stock have been notified, and new listings will be matched automatically.");
    router.refresh();
  }

  return (
    <form onSubmit={submit} className={`${ui.card} space-y-4 p-4`}>
      <div>
        <p className="font-medium text-zinc-900">New buy request</p>
        <p className="mt-1 text-sm text-zinc-500">
          Say what you&apos;ll buy and the most you&apos;ll pay. A matching seller can sell to you in one click; you then
          have 48 hours to pay. Sellers see that a verified buyer is waiting, not your business name.
        </p>
      </div>
      {error && <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700" role="alert">{error}</p>}
      {notified && <p className="rounded-md bg-emerald-50 px-3 py-2 text-sm text-emerald-700" role="status">{notified}</p>}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <label className="block">
          <span className={ui.label}>Category</span>
          <select name="category" required className={ui.input} defaultValue="">
            <option value="" disabled>Choose…</option>
            {LISTING_CATEGORIES.map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
        </label>
        <label className="block">
          <span className={ui.label}>Max price per unit (€, excl. delivery)</span>
          <input name="maxUnitPrice" required inputMode="decimal" pattern="\d+([.,]\d{1,2})?" placeholder="3.80" className={ui.input} />
        </label>
      </div>

      <fieldset>
        <legend className={ui.label}>Conditions you accept</legend>
        <div className="mt-1 flex flex-wrap gap-x-4 gap-y-2">
          {LISTING_CONDITIONS.map((c) => (
            <label key={c.value} className="flex items-center gap-1.5 text-sm text-zinc-700">
              <input type="checkbox" name="conditions" value={c.value} defaultChecked={c.value === "NEW"} />
              {c.label}
            </label>
          ))}
        </div>
      </fieldset>

      <div className="grid grid-cols-2 gap-4">
        <label className="block">
          <span className={ui.label}>Total units wanted</span>
          <input name="quantityWanted" type="number" min={1} required className={ui.input} />
        </label>
        <label className="block">
          <span className={ui.label}>Smallest lot you&apos;ll take</span>
          <input name="minLotQty" type="number" min={1} required className={ui.input} />
        </label>
        <label className="block">
          <span className={ui.label}>Country</span>
          <input name="country" required defaultValue={defaultCountry} className={ui.input} />
        </label>
        <label className="block">
          <span className={ui.label}>City (empty = whole country)</span>
          <input name="city" defaultValue={defaultCity} className={ui.input} />
        </label>
        <label className="block">
          <span className={ui.label}>Open for</span>
          <select name="expiresInDays" defaultValue="30" className={ui.input}>
            <option value="7">7 days</option>
            <option value="30">30 days</option>
            <option value="90">90 days</option>
          </select>
        </label>
      </div>

      <p className="text-xs text-zinc-500">
        By posting you agree to buy at this price when a seller fills your request (Terms §4). If you cancel or
        don&apos;t pay in time, the request is paused.
      </p>
      <button type="submit" disabled={loading} className={ui.btnPrimary}>
        {loading ? "Posting..." : "Post buy request"}
      </button>
    </form>
  );
}
