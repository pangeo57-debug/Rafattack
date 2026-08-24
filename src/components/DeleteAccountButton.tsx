"use client";

import { useState } from "react";
import { signOut } from "next-auth/react";
import { ui } from "@/lib/ui";

export default function DeleteAccountButton({ businessName }: { businessName: string }) {
  const [confirming, setConfirming] = useState(false);
  const [confirmText, setConfirmText] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onDelete() {
    setLoading(true);
    setError(null);
    const res = await fetch("/api/account", { method: "DELETE" });
    if (!res.ok) {
      const json = await res.json();
      setError(json.error ?? "Could not delete your account.");
      setLoading(false);
      return;
    }
    await signOut({ callbackUrl: "/" });
  }

  if (!confirming) {
    return (
      <button onClick={() => setConfirming(true)} className={ui.btnDanger}>
        Delete account
      </button>
    );
  }

  return (
    <div className="space-y-3">
      {error && <p className="text-sm text-red-600">{error}</p>}
      <p className="text-sm text-slate-700">
        Type <strong>{businessName}</strong> to confirm. This permanently removes your
        listings, closes your account, and cannot be undone.
      </p>
      <input
        value={confirmText}
        onChange={(e) => setConfirmText(e.target.value)}
        className={ui.input}
        placeholder={businessName}
      />
      <div className="flex gap-2">
        <button
          onClick={onDelete}
          disabled={confirmText !== businessName || loading}
          className={ui.btnDanger}
        >
          {loading ? "Deleting..." : "Permanently delete my account"}
        </button>
        <button onClick={() => setConfirming(false)} className={ui.btnSecondary}>
          Cancel
        </button>
      </div>
    </div>
  );
}
