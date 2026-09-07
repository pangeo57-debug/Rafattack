"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { signIn } from "next-auth/react";
import Link from "next/link";
import { ui } from "@/lib/ui";
import { BUSINESS_TYPES, LISTING_CATEGORIES } from "@/lib/constants";

export default function SignupPage() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    const form = new FormData(e.currentTarget);
    const body = Object.fromEntries(form.entries());

    try {
      const res = await fetch("/api/signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const json = await res.json();
      if (!res.ok) {
        setError(json.error ?? "Something went wrong.");
        setLoading(false);
        return;
      }
      const signInRes = await signIn("credentials", {
        email: body.email,
        password: body.password,
        redirect: false,
      });
      if (signInRes?.error) {
        setError("Account created — please log in.");
        router.push("/login");
        return;
      }
      router.push("/dashboard");
      router.refresh();
    } catch {
      setError("Something went wrong.");
      setLoading(false);
    }
  }

  return (
    <div className="mx-auto max-w-xl px-4 py-12 sm:px-6">
      <h1 className="text-2xl font-semibold text-zinc-900">Create your business account</h1>
      <p className="mt-1 text-sm text-zinc-600">
        One account represents your business. You can buy and sell from the same account.
      </p>

      {error && (
        <div className="mt-4 rounded-md bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>
      )}

      <form onSubmit={onSubmit} className="mt-6 space-y-6">
        <fieldset className="space-y-4">
          <legend className="text-sm font-semibold text-zinc-900">Your details</legend>
          <div>
            <label className={ui.label}>Full name</label>
            <input name="name" required className={ui.input} />
          </div>
          <div>
            <label className={ui.label}>Work email</label>
            <input name="email" type="email" required className={ui.input} />
          </div>
          <div>
            <label className={ui.label}>Password</label>
            <input name="password" type="password" minLength={8} required className={ui.input} />
          </div>
        </fieldset>

        <fieldset className="space-y-4 border-t border-zinc-200 pt-6">
          <legend className="text-sm font-semibold text-zinc-900">Business details</legend>
          <div>
            <label className={ui.label}>Business name</label>
            <input name="businessName" required className={ui.input} />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className={ui.label}>Business type</label>
              <select name="businessType" required className={ui.input} defaultValue="RETAILER">
                {BUSINESS_TYPES.map((t) => (
                  <option key={t.value} value={t.value}>
                    {t.label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className={ui.label}>Category</label>
              <select name="category" required className={ui.input} defaultValue={LISTING_CATEGORIES[0]}>
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
              <input name="country" required className={ui.input} />
            </div>
            <div>
              <label className={ui.label}>City</label>
              <input name="city" required className={ui.input} />
            </div>
          </div>
          <div>
            <label className={ui.label}>Address (optional)</label>
            <input name="address" className={ui.input} />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className={ui.label}>Tax / VAT ID</label>
              <input name="taxId" required className={ui.input} />
            </div>
            <div>
              <label className={ui.label}>Contact phone (optional)</label>
              <input name="contactPhone" className={ui.input} />
            </div>
          </div>
        </fieldset>

        <label className="flex items-start gap-2 text-sm text-zinc-600">
          <input type="checkbox" name="acceptedTerms" required className="mt-0.5" />
          <span>
            I agree to the{" "}
            <Link href="/terms" target="_blank" className="text-brand hover:underline">
              Terms of Service
            </Link>{" "}
            and{" "}
            <Link href="/privacy" target="_blank" className="text-brand hover:underline">
              Privacy Policy
            </Link>
            .
          </span>
        </label>

        <button type="submit" disabled={loading} className={`${ui.btnPrimary} w-full`}>
          {loading ? "Creating account..." : "Create account"}
        </button>
      </form>

      <p className="mt-6 text-sm text-zinc-600">
        Already have an account?{" "}
        <Link href="/login" className="text-brand hover:underline">
          Log in
        </Link>
      </p>
    </div>
  );
}
