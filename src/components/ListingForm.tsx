"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ui } from "@/lib/ui";
import {
  LISTING_CATEGORIES,
  LISTING_CONDITIONS,
  LISTING_UNITS,
  FULFILLMENT_TYPES,
} from "@/lib/constants";
import type { Listing } from "@prisma/client";
import PhotoUpload from "@/components/PhotoUpload";

export default function ListingForm({ listing }: { listing?: Listing }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [photos, setPhotos] = useState<string[]>(listing ? JSON.parse(listing.photos || "[]") : []);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    const form = new FormData(e.currentTarget);
    const raw = Object.fromEntries(form.entries()) as Record<string, string>;

    const body = { ...raw, photos, expiresAt: raw.expiresAt || null };

    const res = await fetch(listing ? `/api/listings/${listing.id}` : "/api/listings", {
      method: listing ? "PATCH" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    setLoading(false);
    if (!res.ok) {
      const json = await res.json();
      setError(json.error ?? "Could not save listing.");
      return;
    }
    const saved = await res.json();
    router.push(`/listings/${saved.id}`);
    router.refresh();
  }

  return (
    <form onSubmit={onSubmit} className="space-y-5">
      {error && <div className="rounded-md bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}

      <div>
        <label className={ui.label}>Title</label>
        <input name="title" defaultValue={listing?.title} required className={ui.input} />
      </div>
      <div>
        <label className={ui.label}>Description</label>
        <textarea
          name="description"
          defaultValue={listing?.description}
          required
          rows={4}
          className={ui.input}
        />
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className={ui.label}>Category</label>
          <select name="category" defaultValue={listing?.category ?? LISTING_CATEGORIES[0]} className={ui.input}>
            {LISTING_CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className={ui.label}>Condition</label>
          <select name="condition" defaultValue={listing?.condition ?? "NEW"} className={ui.input}>
            {LISTING_CONDITIONS.map((c) => (
              <option key={c.value} value={c.value}>
                {c.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-4">
        <div>
          <label className={ui.label}>Quantity available</label>
          <input
            name="quantityAvailable"
            type="number"
            min={1}
            defaultValue={listing?.quantityAvailable}
            required
            className={ui.input}
          />
        </div>
        <div>
          <label className={ui.label}>Unit of sale</label>
          <select name="unit" defaultValue={listing?.unit ?? "ITEM"} className={ui.input}>
            {LISTING_UNITS.map((u) => (
              <option key={u.value} value={u.value}>
                {u.label}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className={ui.label}>Minimum order qty</label>
          <input
            name="minOrderQty"
            type="number"
            min={1}
            defaultValue={listing?.minOrderQty ?? 1}
            required
            className={ui.input}
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className={ui.label}>Original price (per unit, EUR)</label>
          <input
            name="originalPrice"
            type="number"
            step="0.01"
            min={0}
            defaultValue={listing?.originalPrice}
            required
            className={ui.input}
          />
        </div>
        <div>
          <label className={ui.label}>Asking price (per unit, EUR)</label>
          <input
            name="askingPrice"
            type="number"
            step="0.01"
            min={0}
            defaultValue={listing?.askingPrice}
            required
            className={ui.input}
          />
        </div>
      </div>

      <div className="grid grid-cols-3 gap-4">
        <div>
          <label className={ui.label}>Fulfillment</label>
          <select name="fulfillment" defaultValue={listing?.fulfillment ?? "BOTH"} className={ui.input}>
            {FULFILLMENT_TYPES.map((f) => (
              <option key={f.value} value={f.value}>
                {f.label}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className={ui.label}>City</label>
          <input name="locationCity" defaultValue={listing?.locationCity} required className={ui.input} />
        </div>
        <div>
          <label className={ui.label}>Country</label>
          <input name="locationCountry" defaultValue={listing?.locationCountry} required className={ui.input} />
        </div>
      </div>

      <div>
        <label className={ui.label}>Listing expires on (optional)</label>
        <input
          name="expiresAt"
          type="date"
          defaultValue={listing?.expiresAt ? listing.expiresAt.toString().slice(0, 10) : ""}
          className={ui.input}
        />
      </div>

      <PhotoUpload
        value={photos}
        onChange={setPhotos}
        max={6}
        label="Photos (optional)"
        hint="Take a photo or choose from your library — up to 6."
      />

      <button type="submit" disabled={loading} className={ui.btnPrimary}>
        {loading ? "Saving..." : listing ? "Save changes" : "Publish listing"}
      </button>
    </form>
  );
}
