export const ui = {
  card: "rounded-xl border border-zinc-200 bg-white shadow-[0_1px_2px_rgba(0,0,0,0.04)] transition-shadow",
  cardHover: "hover:shadow-[0_4px_16px_rgba(0,0,0,0.08)] hover:-translate-y-0.5",
  btnPrimary:
    "inline-flex items-center justify-center gap-1.5 rounded-lg bg-brand px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-brand-hover active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed disabled:active:scale-100 transition-all",
  btnSecondary:
    "inline-flex items-center justify-center gap-1.5 rounded-lg border border-zinc-300 bg-white px-4 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50 hover:border-zinc-400 active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed disabled:active:scale-100 transition-all",
  btnDanger:
    "inline-flex items-center justify-center gap-1.5 rounded-lg bg-rose-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-rose-700 active:scale-[0.98] disabled:opacity-50 disabled:active:scale-100 transition-all",
  btnGhost:
    "inline-flex items-center justify-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900 active:scale-[0.98] transition-all",
  input:
    "block w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm text-zinc-900 placeholder:text-zinc-400 outline-none transition-all focus:border-brand focus:ring-4 focus:ring-brand/10",
  label: "block text-sm font-medium text-zinc-700 mb-1.5",
  badge: "inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ring-inset",
};

export function badgeColor(status: string) {
  const map: Record<string, string> = {
    ACTIVE: "bg-emerald-50 text-emerald-700 ring-emerald-600/20",
    PENDING: "bg-amber-50 text-amber-700 ring-amber-600/20",
    VERIFIED: "bg-emerald-50 text-emerald-700 ring-emerald-600/20",
    REJECTED: "bg-rose-50 text-rose-700 ring-rose-600/20",
    SUSPENDED: "bg-rose-50 text-rose-700 ring-rose-600/20",
    ACCEPTED: "bg-emerald-50 text-emerald-700 ring-emerald-600/20",
    COUNTERED: "bg-sky-50 text-sky-700 ring-sky-600/20",
    WITHDRAWN: "bg-zinc-100 text-zinc-600 ring-zinc-500/20",
    EXPIRED: "bg-zinc-100 text-zinc-600 ring-zinc-500/20",
    AWAITING_PAYMENT: "bg-amber-50 text-amber-700 ring-amber-600/20",
    PAID: "bg-sky-50 text-sky-700 ring-sky-600/20",
    SHIPPED: "bg-violet-50 text-violet-700 ring-violet-600/20",
    PICKED_UP: "bg-violet-50 text-violet-700 ring-violet-600/20",
    COMPLETED: "bg-emerald-50 text-emerald-700 ring-emerald-600/20",
    DISPUTED: "bg-rose-50 text-rose-700 ring-rose-600/20",
    CANCELLED: "bg-zinc-100 text-zinc-600 ring-zinc-500/20",
    SOLD_OUT: "bg-zinc-100 text-zinc-600 ring-zinc-500/20",
    PAUSED: "bg-amber-50 text-amber-700 ring-amber-600/20",
    REMOVED: "bg-zinc-100 text-zinc-600 ring-zinc-500/20",
    HOLDING: "bg-amber-50 text-amber-700 ring-amber-600/20",
    RELEASED: "bg-emerald-50 text-emerald-700 ring-emerald-600/20",
    REFUNDED: "bg-zinc-100 text-zinc-600 ring-zinc-500/20",
    OPEN: "bg-rose-50 text-rose-700 ring-rose-600/20",
    NONE: "bg-zinc-100 text-zinc-600 ring-zinc-500/20",
  };
  return map[status] ?? "bg-zinc-100 text-zinc-600 ring-zinc-500/20";
}

export function formatMoney(amount: number) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "EUR" }).format(
    amount
  );
}

export function formatDate(date: Date | string) {
  return new Intl.DateTimeFormat("en-US", {
    dateStyle: "medium",
  }).format(new Date(date));
}
