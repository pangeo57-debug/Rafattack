"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ui } from "@/lib/ui";

export default function ListingStatusActions({
  listingId,
  status,
}: {
  listingId: string;
  status: string;
}) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function setStatus(next: string) {
    setLoading(true);
    await fetch(`/api/listings/${listingId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: next }),
    });
    setLoading(false);
    router.refresh();
  }

  return (
    <div className="flex gap-2">
      {status === "ACTIVE" && (
        <button disabled={loading} onClick={() => setStatus("PAUSED")} className={ui.btnSecondary}>
          Pause
        </button>
      )}
      {status === "PAUSED" && (
        <button disabled={loading} onClick={() => setStatus("ACTIVE")} className={ui.btnSecondary}>
          Reactivate
        </button>
      )}
      {status !== "REMOVED" && (
        <button disabled={loading} onClick={() => setStatus("REMOVED")} className={ui.btnDanger}>
          Remove
        </button>
      )}
    </div>
  );
}
