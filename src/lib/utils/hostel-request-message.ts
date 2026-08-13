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
  /** The hostel-finding service fee (in KSh) this request was charged at. */
  fee?: number;
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
 *
 * The fee used is the one snapshot on the request when it was submitted, so
 * the message always matches the amount the student was charged at the time.
 */
export function buildHostelRequestWhatsAppMessage(
  input: WhatsAppMessageParams,
): string {
  const zone = input.preferredZone || 'Any area';
  const requirements = input.additionalRequirements?.trim() || 'None';
  const fee = (input.fee ?? HOSTEL_REQUEST_FEE).toLocaleString();

  return [
    `Hi ${input.studentName}, thank you for your request on Rumia to help you find a hostel.`,
    '',
    'Here are the details you provided:',
    '',
    `Area/Zone: ${zone}`,
    `Budget: ${budgetLabel(input.budgetRange)}/month`,
    `Gender: ${genderLabel(input.gender)}`,
    `Room Type: ${roomTypeLabel(input.roomType)}`,
    `Furnished: ${furnishingLabel(input.furnishing)}`,
    `Move-in Date: ${formatMoveInDate(input.moveInDate)}`,
    `Phone: ${input.phone}`,
    `Additional Requirements: ${requirements}`,
    '',
    `The hostel-finding request fee is KSh ${fee}, which covers the search and arrangement of a suitable hostel based on your requirements.`,
    '',
    'We will reach out shortly to continue helping you. Let us know if you have any questions.',
  ].join('\n');
}

export { buildHostelRequestWhatsAppMessage as buildHostelRequestMessage };