export const ui = {
  card: "rounded-lg border border-slate-200 bg-white shadow-sm",
  btnPrimary:
    "inline-flex items-center justify-center rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors",
  btnSecondary:
    "inline-flex items-center justify-center rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors",
  btnDanger:
    "inline-flex items-center justify-center rounded-md bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50 transition-colors",
  input:
    "block w-full rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500",
  label: "block text-sm font-medium text-slate-700 mb-1",
  badge: "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium",
};

export function badgeColor(status: string) {
  const map: Record<string, string> = {
    ACTIVE: "bg-emerald-100 text-emerald-800",
    PENDING: "bg-amber-100 text-amber-800",
    VERIFIED: "bg-emerald-100 text-emerald-800",
    REJECTED: "bg-red-100 text-red-800",
    SUSPENDED: "bg-red-100 text-red-800",
    ACCEPTED: "bg-emerald-100 text-emerald-800",
    COUNTERED: "bg-blue-100 text-blue-800",
    WITHDRAWN: "bg-slate-100 text-slate-600",
    EXPIRED: "bg-slate-100 text-slate-600",
    AWAITING_PAYMENT: "bg-amber-100 text-amber-800",
    PAID: "bg-blue-100 text-blue-800",
    SHIPPED: "bg-indigo-100 text-indigo-800",
    PICKED_UP: "bg-indigo-100 text-indigo-800",
    COMPLETED: "bg-emerald-100 text-emerald-800",
    DISPUTED: "bg-red-100 text-red-800",
    CANCELLED: "bg-slate-100 text-slate-600",
    SOLD_OUT: "bg-slate-100 text-slate-600",
    PAUSED: "bg-amber-100 text-amber-800",
    REMOVED: "bg-slate-100 text-slate-600",
    HOLDING: "bg-amber-100 text-amber-800",
    RELEASED: "bg-emerald-100 text-emerald-800",
    REFUNDED: "bg-slate-100 text-slate-600",
    OPEN: "bg-red-100 text-red-800",
    NONE: "bg-slate-100 text-slate-600",
  };
  return map[status] ?? "bg-slate-100 text-slate-600";
}

export function formatMoney(amount: number) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(
    amount
  );
}

export function formatDate(date: Date | string) {
  return new Intl.DateTimeFormat("en-US", {
    dateStyle: "medium",
  }).format(new Date(date));
}
