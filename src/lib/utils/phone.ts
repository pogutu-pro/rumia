/**
 * Shared phone and WhatsApp utilities for Rumia.
 *
 * Consolidates the `cleanPhone` / WhatsApp URL builder that was previously
 * duplicated across:
 *  - agent-card.tsx
 *  - agent-contact-section.tsx
 *  - whatsapp-button.tsx
 *  - api/track-lead/route.ts
 *
 * ALL new code must import from here — never inline.
 */

/**
 * Normalises a Kenyan phone number to E.164 format (+254…).
 * Strips all non-digit/non-plus characters, then adds the +254 country code
 * if no international prefix is present.
 */
export function cleanPhone(phone: string): string {
  const clean = phone.replace(/[^\d+]/g, '');
  return clean.startsWith('+') ? clean : clean.replace(/^0?/, '+254');
}

/**
 * Validates a raw Kenyan phone string.
 * Accepts: 07XXXXXXXX, 01XXXXXXXX, +2547XXXXXXX, 2547XXXXXXX
 * Returns true only when the number has 9 local digits (after country code).
 */
export function isValidKenyanPhone(phone: string): boolean {
  const cleaned = cleanPhone(phone);
  // Must be +254 followed by 9 digits
  return /^\+254[17]\d{8}$/.test(cleaned);
}

/**
 * Builds a wa.me deep-link.
 * @param phone - Any Kenyan phone format; will be cleaned automatically.
 * @param message - Optional pre-filled message text.
 */
export function buildWhatsAppUrl(phone: string, message?: string): string {
  const cleaned = cleanPhone(phone);
  if (!message) return `https://wa.me/${cleaned}`;
  return `https://wa.me/${cleaned}?text=${encodeURIComponent(message)}`;
}

/** WhatsApp message for Hostel Owner contact flow */
export function hostelOwnerMessage(hostelTitle: string): string {
  return `Hi, I found ${hostelTitle} on Rumia and I'm interested in the room. Could you please share more details?`;
}

/** WhatsApp message for Rumia Agent contact flow — commission-paying hostel */
export function agentInquiryMessage(hostelTitle: string, agentName: string): string {
  return `Hi ${agentName}, I saw ${hostelTitle} on Rumia and I'd like your help with accommodation. Could you assist me with availability, pricing, and arranging a viewing?`;
}

/** WhatsApp message for Rumia Agent — non-commission hostel (user accepted KES 50 fee) */
export function agentFeeAcceptedMessage(hostelTitle: string, agentName: string): string {
  return `Hi ${agentName}, I saw ${hostelTitle} on Rumia and I'd like your help with accommodation. I understand a KES 50 consultation fee may apply and I accept this. Could you assist me with availability, pricing, and arranging a viewing?`;
}
