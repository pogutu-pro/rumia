'use client';

import { ContactActions } from '@/components/contact/contact-actions';

interface ContactButtonProps {
  listingId: string;
  listingTitle: string;
  agentPhone?: string;
  layout?: 'bar' | 'card';
  className?: string;
  // Accepted for compatibility with existing pages; the contact no longer depends on them.
  agentId?: string;
  landlordPhone?: string | null;
  paysCommission?: boolean;
  consultationFee?: number | null;
  isFull?: boolean;
  fullWidth?: boolean;
}

/** One tap to WhatsApp (or call): no sign-in, no phone number, no fee step, no choice of who to contact. */
export function ContactButton({ listingId, listingTitle, agentPhone, layout = 'card', className }: ContactButtonProps) {
  return (
    <ContactActions
      listingId={listingId}
      title={listingTitle}
      fallbackPhone={agentPhone}
      layout={layout}
      className={className}
    />
  );
}
