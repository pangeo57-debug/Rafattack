// Money in integer cents. Parsing goes through the decimal string, never
// through a float, so "0.29" is 29 cents and not 28.999999.

export function parseEuroToCents(input: unknown): number | null {
  const s = typeof input === "number" ? String(input) : typeof input === "string" ? input.trim().replace(",", ".") : "";
  const m = /^(\d{1,9})(?:\.(\d{1,2}))?$/.exec(s);
  if (!m) return null;
  return Number(m[1]) * 100 + Number((m[2] ?? "").padEnd(2, "0"));
}

export function formatCents(cents: number, currency = "EUR") {
  return new Intl.NumberFormat("en-US", { style: "currency", currency }).format(cents / 100);
}
