"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ui } from "@/lib/ui";

export default function BusinessVerificationActions({ businessId }: { businessId: string }) {
  const router = useRouter();
  const [loading, setLoading] = useState<string | null>(null);

  async function setStatus(verificationStatus: string) {
    setLoading(verificationStatus);
    await fetch(`/api/admin/businesses/${businessId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ verificationStatus }),
    });
    setLoading(null);
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
    </div>
  );
}
