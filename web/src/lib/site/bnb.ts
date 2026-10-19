import { buildWhatsAppUrl } from '@/lib/utils/phone';

/** RumiaBnB brand constants shared by its pages. */
export const BNB_NAME = 'RumiaBnB';

/** "Hosted by" when a listing has no host name of its own. A setting, so it can change without code. */
export const BNB_DEFAULT_HOST_NAME = (process.env.NEXT_PUBLIC_BNB_DEFAULT_HOST_NAME || 'Paul Ogutu').trim();

/**
 * The staffed RumiaBnB WhatsApp number (the concierge). Build-time public value; empty hides every concierge button
 * rather than sending guests to a wrong number.
 */
export const BNB_CONCIERGE_WHATSAPP = (process.env.NEXT_PUBLIC_BNB_CONCIERGE_WHATSAPP || '').trim();

export function conciergeUrl(message: string): string | null {
  return BNB_CONCIERGE_WHATSAPP ? buildWhatsAppUrl(BNB_CONCIERGE_WHATSAPP, message) : null;
}
