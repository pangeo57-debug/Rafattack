"use client";

import { useState } from "react";
import Link from "next/link";
import { ui } from "@/lib/ui";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    const res = await fetch("/api/auth/forgot-password", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email }),
    });
    setLoading(false);
    if (!res.ok) {
      const json = await res.json();
      setError(json.error ?? "Something went wrong.");
      return;
    }
    setSent(true);
  }

  return (
    <div className="mx-auto max-w-md px-4 py-16 sm:px-6">
      <h1 className="text-2xl font-semibold text-zinc-900">Reset your password</h1>

      {sent ? (
        <p className="mt-4 rounded-lg bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
          If an account exists for {email}, we&apos;ve sent a password reset link. It expires
          in 1 hour.
        </p>
      ) : (
        <>
          <p className="mt-1 text-sm text-zinc-600">
            Enter your email and we&apos;ll send you a link to reset your password.
          </p>
          {error && (
            <div className="mt-4 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>
          )}
          <form onSubmit={onSubmit} className="mt-6 space-y-4">
            <div>
              <label className={ui.label}>Email</label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className={ui.input}
              />
            </div>
            <button type="submit" disabled={loading} className={`${ui.btnPrimary} w-full`}>
              {loading ? "Sending..." : "Send reset link"}
            </button>
          </form>
        </>
      )}

      <p className="mt-6 text-sm text-zinc-600">
        <Link href="/login" className="text-brand hover:underline">
          Back to log in
        </Link>
      </p>
    </div>
  );
}
