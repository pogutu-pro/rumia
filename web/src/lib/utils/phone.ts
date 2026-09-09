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

/**
 * WhatsApp message for Hostel Owner contact flow.
 * Dynamically builds the message from listing data so it stays
 * in sync with the actual listing content.
 */
export interface HostelOwnerMessageParams {
  title: string;
  roomType?: string;
  price?: number;
  zone?: string;
  slug?: string;
  county?: string;
  hasVideo?: boolean;
}

/**
 * Builds a WhatsApp pre-filled message for contacting a hostel owner directly.
 * If the listing has no video, the "and the video" clause is dropped while
 * keeping the rest of the sentence grammatically correct.
 */
export function hostelOwnerMessage(params: HostelOwnerMessageParams): string {
  const {
    title,
    roomType,
    price,
    zone,
    slug,
    county = 'nyeri',
    hasVideo = false,
  } = params;

  const parts: string[] = [];
  parts.push(`Hi, I saw ${title} on Rumia.`);

  if (roomType && price != null) {
    parts.push(
      `It's the ${roomType} going for KES ${price.toLocaleString()} in ${zone ?? 'the area'}.`,
    );
  } else if (roomType) {
    parts.push(`It's the ${roomType} in ${zone ?? 'the area'}.`);
  } else if (price != null) {
    parts.push(
      `It's going for KES ${price.toLocaleString()} in ${zone ?? 'the area'}.`,
    );
  } else if (zone) {
    parts.push(`It's in ${zone}.`);
  }

  if (hasVideo) {
    parts.push(
      "I've already gone through the details,photos and the video, so I have a good idea of the place.",
    );
  } else {
    parts.push(
      "I've already gone through the photos, so I have a good idea of the place.",
    );
  }

  parts.push(
    'Is it still available, and how do I pay the deposit to reserve it?',
  );

  let message = parts.join(' ');

  if (slug && zone) {
    message = `${message}\n\nListing: rumia.co.ke/hostels/${county}/${zone}/${slug}`;
  }

  return message;
}

/**
 * WhatsApp message for a general agent inquiry (Verify page, agent profile, agent card).
 * Uses Pochi payment details when both are set; falls back to the agent's
 * base WhatsApp number and display name otherwise.
 */
export function agentInquiryMessage(params: {
  agentName: string;
  whatsapp: string;
  pochiLaBiasharaNumber?: string | null;
  expectedName?: string | null;
  consultationFee?: number | null;
}): string {
  const { agentName, whatsapp, pochiLaBiasharaNumber, expectedName, consultationFee } = params;
  const paymentNumber = pochiLaBiasharaNumber ?? whatsapp;
  const paymentName = expectedName ?? agentName;
  const feeText = consultationFee && consultationFee > 0 ? ` Paid consultation fee: KES ${consultationFee}.` : '';
  return `Hello ${agentName}, I am interested in a hostel and would like to request your professional consultation. Please advise on available options within my budget and preferred location.${feeText} Payment to ${paymentNumber} (${paymentName}). I will send payment once you confirm availability.`;
}

/**
 * WhatsApp message for the platform owner (main support).
 * Focuses on reporting/solving issues; hostel consultation remains a paid service.
 */
export function ownerSupportMessage(params: {
  ownerName: string;
  whatsapp: string;
  pochiLaBiasharaNumber?: string | null;
  expectedName?: string | null;
  consultationFee?: number | null;
}): string {
  const { ownerName, whatsapp, pochiLaBiasharaNumber, expectedName, consultationFee } = params;
  const paymentNumber = pochiLaBiasharaNumber ?? whatsapp;
  const paymentName = expectedName ?? ownerName;
  const feeText = consultationFee && consultationFee > 0 ? ` The paid consultation fee is KES ${consultationFee} —` : '';
  return `Hello ${ownerName}, I need help with an issue on Rumia and would like to report it directly to you. Please help me resolve it.${feeText} Payment to ${paymentNumber} (${paymentName}). I will send payment once you confirm.`;
}

/**
 * WhatsApp message for a hostel-specific agent inquiry (listing page, Rumia Agent flow).
 * Uses Pochi payment details when both are set; falls back to the agent's
 * base WhatsApp number and the agent's display name otherwise.
 *
 * @param listingTitle - the hostel being viewed
 * @param agentName - the agent's display name
 * @param whatsapp - the agent's base WhatsApp number (used as fallback)
 * @param pochiLaBiasharaNumber - optional Pochi la Biashara number
 * @param expectedName - optional name registered to the Pochi number
 */
export function agentHostelInquiryMessage(params: {
  listingTitle: string;
  agentName: string;
  whatsapp: string;
  pochiLaBiasharaNumber?: string | null;
  expectedName?: string | null;
  consultationFee?: number | null;
  isFull?: boolean;
}): string {
  const {
    listingTitle,
    agentName,
    whatsapp,
    pochiLaBiasharaNumber,
    expectedName,
    consultationFee,
    isFull,
  } = params;
  const paymentNumber = pochiLaBiasharaNumber ?? whatsapp;
  const paymentName = expectedName ?? agentName;
  const feeText = consultationFee && consultationFee > 0 ? ` Paid consultation fee: KES ${consultationFee.toLocaleString()}.` : '';

  if (isFull) {
    const feeLine =
      consultationFee && consultationFee > 0
        ? `Consultation fee: KES ${consultationFee.toLocaleString()}. Payment to ${paymentNumber} (${paymentName}). I'll send the payment once you confirm.`
        : `Payment to ${paymentNumber} (${paymentName}). I'll send the payment once you confirm.`;

    return `Hello, I saw that ${listingTitle} is currently full on Rumia. Could you recommend other available hostels nearby within my budget?\n\n${feeLine}`;
  }

  return `Hello, I am interested in ${listingTitle} on Rumia and would like your professional guidance on whether it suits my budget and requirements, or if you can recommend better alternatives.\n\nPayment to ${paymentNumber} (${paymentName}). I will send payment once you confirm availability.`;
}

/**
 * WhatsApp message an agent sends to confirm an upcoming tour to a student.
 * One-tap from the agent dashboard: opens WhatsApp pre-filled with the tour
 * details so the agent can confirm "we will be there" with a single send.
 */
export function tourConfirmationMessage(params: {
  studentName: string;
  agentName: string;
  date: string;
  timeLabel: string;
  zone?: string;
  listingTitle?: string;
  agentPhone?: string;
}): string {
  const { studentName, agentName, date, timeLabel, zone, listingTitle, agentPhone } =
    params;
  const destination = listingTitle ?? zone;
  const when = `${date} (${timeLabel})`;
  const base = `Hi ${studentName}, this is ${agentName} from Rumia.`;
  const details = destination
    ? `Your tour for ${when} in ${destination} is confirmed.`
    : `Your tour for ${when} is confirmed.`;
  const call = agentPhone
    ? ` Please call us at ${agentPhone} on the day of your visit to let us know you're on your way.`
    : '';
  return `${base} ${details} We will be there to show you around.${call} See you then!`;
}
