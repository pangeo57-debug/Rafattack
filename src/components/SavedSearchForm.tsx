"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ui } from "@/lib/ui";
import { LISTING_CATEGORIES } from "@/lib/constants";

export default function SavedSearchForm() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    const form = new FormData(e.currentTarget);
    const body = Object.fromEntries(form.entries());
    const res = await fetch("/api/saved-searches", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    setLoading(false);
    if (!res.ok) {
      const json = await res.json();
      setError(json.error ?? "Could not save search.");
      return;
    }
    (e.target as HTMLFormElement).reset();
    router.refresh();
  }

  return (
    <form onSubmit={onSubmit} className={`${ui.card} grid grid-cols-2 gap-3 p-4 sm:grid-cols-5`}>
      {error && <p className="col-span-full text-sm text-red-600">{error}</p>}
      <input name="keyword" placeholder="Keyword" className={ui.input} />
      <select name="category" defaultValue="" className={ui.input}>
        <option value="">Any category</option>
        {LISTING_CATEGORIES.map((c) => (
          <option key={c} value={c}>
            {c}
          </option>
        ))}
      </select>
      <input name="location" placeholder="City or country" className={ui.input} />
      <input name="minPrice" type="number" step="0.01" placeholder="Min price" className={ui.input} />
      <input name="maxPrice" type="number" step="0.01" placeholder="Max price" className={ui.input} />
      <button type="submit" disabled={loading} className={`${ui.btnPrimary} col-span-full sm:col-span-1`}>
        {loading ? "Saving..." : "Save search"}
      </button>
    </form>
  );
}
