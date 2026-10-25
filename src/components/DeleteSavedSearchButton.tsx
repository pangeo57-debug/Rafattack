"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export default function DeleteSavedSearchButton({ id }: { id: string }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function onDelete() {
    setLoading(true);
    await fetch(`/api/saved-searches/${id}`, { method: "DELETE" });
    setLoading(false);
    router.refresh();
  }

  return (
    <button
      onClick={onDelete}
      disabled={loading}
      className="text-sm text-red-600 hover:underline disabled:opacity-50"
    >
      Remove
    </button>
  );
}
