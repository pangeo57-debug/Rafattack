"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { ui } from "@/lib/ui";

function VerifyEmailContent() {
  const searchParams = useSearchParams();
  const token = searchParams.get("token") ?? "";
  const [status, setStatus] = useState<"loading" | "success" | "error">(
    token ? "loading" : "error"
  );
  const [error, setError] = useState<string | null>(
    token ? null : "Missing verification token."
  );

  useEffect(() => {
    if (!token) return;
    fetch("/api/auth/verify-email", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token }),
    })
      .then(async (res) => {
        if (!res.ok) {
          const json = await res.json();
          setError(json.error ?? "Could not verify your email.");
          setStatus("error");
          return;
        }
        setStatus("success");
      })
      .catch(() => {
        setError("Could not verify your email.");
        setStatus("error");
      });
  }, [token]);

  if (status === "loading") {
    return <p className="mt-4 text-sm text-zinc-500">Verifying...</p>;
  }

  if (status === "error") {
    return (
      <div className="mt-4 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">
        {error}{" "}
        <Link href="/dashboard/account" className="underline">
          Request a new link from your account settings
        </Link>
        .
      </div>
    );
  }

  return (
    <div className="mt-4 rounded-lg bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
      Your email is verified.{" "}
      <Link href="/dashboard" className={`${ui.btnPrimary} ml-2`}>
        Go to dashboard
      </Link>
    </div>
  );
}

export default function VerifyEmailPage() {
  return (
    <div className="mx-auto max-w-md px-4 py-16 sm:px-6">
      <h1 className="text-2xl font-semibold text-zinc-900">Email verification</h1>
      <Suspense fallback={null}>
        <VerifyEmailContent />
      </Suspense>
    </div>
  );
}
