"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ui } from "@/lib/ui";
import { MAX_MESSAGE_LENGTH } from "@/lib/order-messages";

export default function OrderMessageForm({ transactionId, otherParty }: { transactionId: string; otherParty: string }) {
  const router = useRouter();
  const [body, setBody] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [warning, setWarning] = useState<string | null>(null);

  async function send(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    const res = await fetch(`/api/transactions/${transactionId}/messages`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ body }),
    });
    const json = await res.json().catch(() => ({}));
    setLoading(false);
    if (!res.ok) {
      setError(json.error ?? "Could not send the message.");
      return;
    }
    setBody("");
    setWarning(json.warning ?? null);
    router.refresh();
  }

  return (
    <form onSubmit={send} className="mt-3 space-y-2">
      {warning && (
        <p className="rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-800" role="status">{warning}</p>
      )}
      <textarea
        value={body}
        onChange={(e) => setBody(e.target.value)}
        maxLength={MAX_MESSAGE_LENGTH}
        rows={3}
        required
        placeholder={`Message the ${otherParty}: pickup time, delivery address, questions…`}
        className={ui.input}
      />
      {error && <p className="text-sm text-rose-600" role="alert">{error}</p>}
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs text-zinc-500">Messages can&apos;t be edited or deleted; our team reads them if the order is disputed.</p>
        <button type="submit" disabled={loading || !body.trim()} className={ui.btnPrimary}>
          {loading ? "Sending..." : "Send"}
        </button>
      </div>
    </form>
  );
}
