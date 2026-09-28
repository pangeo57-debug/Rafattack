// Netlify scheduled function: once an hour, ask the app to apply order
// deadlines (unpaid orders expire, unshipped orders are refunded, shipped
// orders nobody complained about are completed). The logic itself lives in
// src/lib/order-timers.ts; this only rings the bell.
export default async function orderTimers() {
  const base = process.env.URL; // set by Netlify to the site's main URL
  const secret = process.env.CRON_SECRET;
  if (!base || !secret) {
    console.error("order-timers: URL or CRON_SECRET missing, not running");
    return;
  }
  const res = await fetch(`${base}/api/cron/order-timers`, {
    method: "POST",
    headers: { authorization: `Bearer ${secret}` },
  });
  console.log("order-timers", res.status, await res.text());
}

export const config = { schedule: "@hourly" };
