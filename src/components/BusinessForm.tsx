"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ui } from "@/lib/ui";
import { BUSINESS_TYPES, LISTING_CATEGORIES } from "@/lib/constants";
import type { Business } from "@prisma/client";

export default function BusinessForm({ business }: { business: Business }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setSaved(false);
    setLoading(true);
    const form = new FormData(e.currentTarget);
    const body = Object.fromEntries(form.entries());
    const res = await fetch("/api/business", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    setLoading(false);
    if (!res.ok) {
      const json = await res.json();
      setError(json.error ?? "Could not save changes.");
      return;
    }
    setSaved(true);
    router.refresh();
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      {error && <div className="rounded-md bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}
      {saved && (
        <div className="rounded-md bg-emerald-50 px-4 py-3 text-sm text-emerald-700">Saved.</div>
      )}
      <div>
        <label className={ui.label}>Business name</label>
        <input name="name" defaultValue={business.name} required className={ui.input} />
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className={ui.label}>Business type</label>
          <select name="type" defaultValue={business.type} className={ui.input}>
            {BUSINESS_TYPES.map((t) => (
              <option key={t.value} value={t.value}>
                {t.label}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className={ui.label}>Category</label>
          <select name="category" defaultValue={business.category} className={ui.input}>
            {LISTING_CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className={ui.label}>Country</label>
          <input name="country" defaultValue={business.country} required className={ui.input} />
        </div>
        <div>
          <label className={ui.label}>City</label>
          <input name="city" defaultValue={business.city} required className={ui.input} />
        </div>
      </div>
      <div>
        <label className={ui.label}>Address</label>
        <input name="address" defaultValue={business.address ?? ""} className={ui.input} />
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className={ui.label}>Tax / VAT ID</label>
          <input name="taxId" defaultValue={business.taxId} required className={ui.input} />
        </div>
        <div>
          <label className={ui.label}>Contact phone</label>
          <input name="contactPhone" defaultValue={business.contactPhone ?? ""} className={ui.input} />
        </div>
      </div>
      <div>
        <label className={ui.label}>Contact email</label>
        <input name="contactEmail" type="email" defaultValue={business.contactEmail} required className={ui.input} />
      </div>
      <button type="submit" disabled={loading} className={ui.btnPrimary}>
        {loading ? "Saving..." : "Save changes"}
      </button>
    </form>
  );
}
