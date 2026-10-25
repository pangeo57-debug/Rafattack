import { Resend } from "resend";

// Any user-supplied text (business name, etc.) interpolated into an email
// body must go through this first — emails are raw HTML strings, not React,
// so nothing escapes them automatically the way JSX does.
export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

const apiKey = process.env.RESEND_API_KEY;
const resend = apiKey ? new Resend(apiKey) : null;
const FROM = process.env.EMAIL_FROM ?? "Surplo <onboarding@resend.dev>";

export async function sendEmail(to: string, subject: string, html: string) {
  if (!resend) {
    // No email provider configured (e.g. local dev) — log instead of sending,
    // so links (verify/reset) are still visible and testable.
    console.log(`[email:dev-fallback] To: ${to}\nSubject: ${subject}\n${html}`);
    return { devFallback: true };
  }
  const result = await resend.emails.send({ from: FROM, to, subject, html });
  return result;
}

export function emailShell(title: string, bodyHtml: string) {
  return `
    <div style="font-family: -apple-system, sans-serif; max-width: 480px; margin: 0 auto; padding: 24px;">
      <h1 style="font-size: 18px; color: #18181b;">${title}</h1>
      <div style="font-size: 14px; color: #3f3f46; line-height: 1.6;">${bodyHtml}</div>
      <p style="margin-top: 32px; font-size: 12px; color: #a1a1aa;">Surplo</p>
    </div>
  `;
}
