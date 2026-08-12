import { format, parseISO } from 'date-fns';
import {
  HOSTEL_REQUEST_FEE,
  genderLabel,
  roomTypeLabel,
  furnishingLabel,
  budgetLabel,
} from '@/lib/constants/hostel-requests';

interface WhatsAppMessageParams {
  studentName: string;
  preferredZone: string | null;
  budgetRange: string;
  gender: string;
  roomType: string;
  furnishing: string;
  moveInDate: string | null;
  phone: string;
  additionalRequirements: string | null;
}

function formatMoveInDate(date: string | null): string {
  if (!date) return 'Flexible';
  try {
    return format(parseISO(date), 'd MMM yyyy');
  } catch {
    return 'Flexible';
  }
}

/**
 * Builds the ready-to-send WhatsApp message a manager copies when picking up a
 * hostel request. Kept as a pure function so it can be unit tested and reused
 * verbatim by the Manager Dashboard.
 */
export function buildHostelRequestWhatsAppMessage(
  input: WhatsAppMessageParams,
): string {
  const zone = input.preferredZone || 'Any area';
  const requirements = input.additionalRequirements?.trim() || 'None';
  const fee = `KSh ${HOSTEL_REQUEST_FEE.toLocaleString()}`;

  return [
    `Hi ${input.studentName}, we saw that you submitted a request on Rumia to help you find a hostel.`,
    '',
    'Here are the details you provided:',
    '',
    `📍 Area/Zone: ${zone}`,
    `💰 Budget: ${budgetLabel(input.budgetRange)}/month`,
    `👤 Gender: ${genderLabel(input.gender)}`,
    `🛏️ Room Type: ${roomTypeLabel(input.roomType)}`,
    `🪑 Furnished: ${furnishingLabel(input.furnishing)}`,
    `📅 Move-in Date: ${formatMoveInDate(input.moveInDate)}`,
    `📱 Phone: ${input.phone}`,
    `📝 Additional Requirements: ${requirements}`,
    '',
    `The hostel-finding request fee is **${fee}**.`,
    '',
    'We will help you find a suitable hostel based on your requirements. Let us know if you have any questions.',
  ].join('\n');
}

export { buildHostelRequestWhatsAppMessage as buildHostelRequestMessage };