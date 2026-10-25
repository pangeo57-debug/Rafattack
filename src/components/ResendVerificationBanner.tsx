"use client";

import { useState } from "react";
import { Mail } from "lucide-react";

export default function ResendVerificationBanner() {
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function resend() {
    setLoading(true);
    setError(null);
    const res = await fetch("/api/auth/resend-verification", { method: "POST" });
    setLoading(false);
    if (!res.ok) {
      const json = await res.json();
      setError(json.error ?? "Could not resend verification email.");
      return;
    }
    setSent(true);
  }

  return (
    <div className="flex flex-wrap items-center gap-2 border-b border-amber-200 bg-amber-50 px-4 py-2.5 text-sm text-amber-800 sm:px-6">
      <Mail className="h-4 w-4 shrink-0" />
      <span>Please verify your email address.</span>
      {sent ? (
        <span className="font-medium">Sent — check your inbox.</span>
      ) : (
        <button onClick={resend} disabled={loading} className="font-medium underline disabled:opacity-50">
          {loading ? "Sending..." : "Resend verification email"}
        </button>
      )}
      {error && <span className="text-red-700">{error}</span>}
    </div>
  );
}
