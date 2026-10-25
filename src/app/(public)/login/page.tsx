"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { signIn } from "next-auth/react";
import Link from "next/link";
import { ui } from "@/lib/ui";

export default function LoginPage() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    const form = new FormData(e.currentTarget);
    const res = await signIn("credentials", {
      email: form.get("email"),
      password: form.get("password"),
      redirect: false,
    });
    setLoading(false);
    if (res?.error) {
      setError("Invalid email or password, or your account is temporarily locked after too many attempts.");
      return;
    }
    router.push("/dashboard");
    router.refresh();
  }

  return (
    <div className="mx-auto max-w-md px-4 py-16 sm:px-6">
      <h1 className="text-2xl font-semibold text-zinc-900">Log in</h1>

      {error && (
        <div className="mt-4 rounded-md bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>
      )}

      <form onSubmit={onSubmit} className="mt-6 space-y-4">
        <div>
          <label className={ui.label}>Email</label>
          <input name="email" type="email" required className={ui.input} />
        </div>
        <div>
          <div className="flex items-center justify-between">
            <label className={ui.label}>Password</label>
            <Link href="/forgot-password" className="mb-1 text-xs text-brand hover:underline">
              Forgot password?
            </Link>
          </div>
          <input name="password" type="password" required className={ui.input} />
        </div>
        <button type="submit" disabled={loading} className={`${ui.btnPrimary} w-full`}>
          {loading ? "Logging in..." : "Log in"}
        </button>
      </form>

      <p className="mt-6 text-sm text-zinc-600">
        Need an account?{" "}
        <Link href="/signup" className="text-brand hover:underline">
          Sign up
        </Link>
      </p>
    </div>
  );
}
