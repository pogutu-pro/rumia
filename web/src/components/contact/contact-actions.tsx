'use client';

import { useState } from 'react';
import { MessageCircle, Phone, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { rumia, unwrap } from '@/lib/api/rumia';
import { fallbackWhatsAppUrl, rememberFollowUp } from '@/lib/contact';
import { track } from '@/lib/events';

interface ContactActionsProps {
  /** Legacy listing id (current pages) or the property id/slug (new pages); one is required. */
  listingId?: string;
  propertyId?: string;
  title: string;
  /** Used only if the contact could not be logged, so a seeker is never stopped from reaching the owner. */
  fallbackPhone?: string | null;
  source?: string;
  /** `bar` = sticky mobile bar (WhatsApp + Call side by side); `card` = stacked, for the desktop card. */
  layout?: 'bar' | 'card';
  className?: string;
}

function isTouchDevice(): boolean {
  return typeof window !== 'undefined' && window.matchMedia?.('(pointer: coarse)').matches;
}

export function ContactActions({
  listingId,
  propertyId,
  title,
  fallbackPhone,
  source = 'property',
  layout = 'card',
  className = '',
}: ContactActionsProps) {
  const [busy, setBusy] = useState<'whatsapp' | 'call' | null>(null);

  async function contact(channel: 'whatsapp' | 'call') {
    if (busy) return;
    setBusy(channel);
    // On desktop open the tab now (inside the click) so the browser does not block it after the request.
    const popup = !isTouchDevice() && channel === 'whatsapp' ? window.open('', '_blank') : null;
    let url: string | null = null;
    try {
      const result = unwrap(
        await rumia.POST('/api/v1/inquiries', {
          body: { listing_id: listingId, property_id: propertyId, channel, source },
        }),
      );
      url = channel === 'whatsapp' ? (result.whatsapp_url ?? null) : (result.tel_url ?? null);
      if (channel === 'whatsapp') rememberFollowUp({ ref: result.ref_code, name: result.contact_name, at: Date.now() });
    } catch {
      // Logging failed (offline, rate limit, server). Do not block the contact.
      if (channel === 'whatsapp') url = fallbackWhatsAppUrl(fallbackPhone, title);
      else if (fallbackPhone) url = `tel:${fallbackPhone.replace(/\s+/g, '')}`;
      if (!url) toast.error('Could not open the chat right now. Please try again.');
    } finally {
      setBusy(null);
    }
    if (!url) {
      popup?.close();
      return;
    }
    if (popup) popup.location.href = url;
    else window.location.href = url;
  }

  const whatsapp = (
    <button
      type="button"
      onClick={() => void contact('whatsapp')}
      disabled={busy !== null}
      className={`inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-emerald-700 px-5 text-base font-semibold text-white transition-colors hover:bg-emerald-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-700 focus-visible:ring-offset-2 disabled:opacity-70 ${
        layout === 'bar' ? 'flex-[3]' : 'w-full'
      }`}
    >
      {busy === 'whatsapp' ? <Loader2 className="h-5 w-5 animate-spin" aria-hidden="true" /> : <MessageCircle className="h-5 w-5" aria-hidden="true" />}
      WhatsApp
    </button>
  );
  const call = (
    <button
      type="button"
      onClick={() => void contact('call')}
      disabled={busy !== null}
      className={`inline-flex min-h-12 items-center justify-center gap-2 rounded-xl border border-slate-300 bg-white px-4 text-base font-semibold text-slate-900 transition-colors hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-700 focus-visible:ring-offset-2 disabled:opacity-70 ${
        layout === 'bar' ? 'flex-[2]' : 'w-full'
      }`}
    >
      {busy === 'call' ? <Loader2 className="h-5 w-5 animate-spin" aria-hidden="true" /> : <Phone className="h-5 w-5" aria-hidden="true" />}
      Call
    </button>
  );

  return (
    <div className={`${layout === 'bar' ? 'flex gap-2' : 'flex flex-col gap-2'} ${className}`} data-testid="contact-actions">
      {whatsapp}
      {call}
    </div>
  );
}

/** Kept so existing pages keep working while they are rebuilt: same props, no sign-in, no phone, no fee step. */
export function trackContactIntent(listingId: string) {
  track('property_opened', { surface: 'property', listingId, props: { action: 'contact_click' } });
}
