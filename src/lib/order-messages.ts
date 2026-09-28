// Order messages: what counts as a valid message, and a gentle warning when
// people start moving the deal off the platform. We don't block contact
// details (buyers and sellers often need a phone number to arrange pickup),
// but we remind them that payment outside Surplo isn't protected.

export const MAX_MESSAGE_LENGTH = 2000;

const EMAIL = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i;
const PHONE = /(\+?\d[\d\s().-]{8,}\d)/;
const IBAN = /\b[A-Z]{2}\d{2}(?:\s?[A-Z0-9]){11,30}\b/;
const PAY_OUTSIDE = /\b(iban|bank transfer|pay (me )?directly|cash on|revolut|paypal)\b/i;
// \b only understands Latin letters, so Greek stems are matched on their own.
const PAY_OUTSIDE_EL = /(μετρητ|κατάθεσ|καταθεσ|τράπεζ|τραπεζ|απευθείας πληρωμ|πληρωμή απευθείας)/iu;

export function offPlatformWarning(body: string): string | null {
  if (IBAN.test(body.toUpperCase().replace(/\s+/g, " ")) || PAY_OUTSIDE.test(body) || PAY_OUTSIDE_EL.test(body)) {
    return "Paying outside Surplo is not protected: no escrow, no refund if the goods don't arrive. Always pay through the order page.";
  }
  if (EMAIL.test(body) || PHONE.test(body)) {
    return "Sharing contact details to arrange delivery is fine. Keep payment on Surplo so it stays protected by escrow.";
  }
  return null;
}
