"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ui } from "@/lib/ui";

export default function BusinessVerificationActions({ businessId }: { businessId: string }) {
  const router = useRouter();
  const [loading, setLoading] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function setStatus(verificationStatus: string) {
    let verificationNote: string | undefined;
    if (verificationStatus !== "VERIFIED") {
      const note = window.prompt("Reason the business will read (required):");
      if (note === null) return;
      verificationNote = note;
    }
    setLoading(verificationStatus);
    setError(null);
    const res = await fetch(`/api/admin/businesses/${businessId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ verificationStatus, verificationNote }),
    });
    setLoading(null);
    if (!res.ok) {
      const json = await res.json().catch(() => ({}));
      setError(json.error ?? "Something went wrong.");
      return;
    }
    router.refresh();
  }

  return (
    <div className="flex flex-wrap gap-2">
      <button disabled={loading !== null} onClick={() => setStatus("VERIFIED")} className={ui.btnPrimary}>
        Verify
      </button>
      <button disabled={loading !== null} onClick={() => setStatus("REJECTED")} className={ui.btnSecondary}>
        Reject
      </button>
      <button disabled={loading !== null} onClick={() => setStatus("SUSPENDED")} className={ui.btnDanger}>
        Suspend
      </button>
      {error && <p className="w-full text-sm text-rose-600" role="alert">{error}</p>}
    </div>
  );
}
