"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export default function MarkAllReadButton() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function markAllRead() {
    setLoading(true);
    await fetch("/api/notifications", { method: "PATCH" });
    setLoading(false);
    router.refresh();
  }

  return (
    <button
      onClick={markAllRead}
      disabled={loading}
      className="text-sm font-medium text-brand hover:underline disabled:opacity-50"
    >
      Mark all as read
    </button>
  );
}
