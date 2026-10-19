'use client';

import { useState } from 'react';
import { MessageCircle } from 'lucide-react';
import { staysApi } from '@/lib/site/bnb-api';
import { attributionFor } from '@/lib/site/attribution';
import { sessionId } from '@/lib/events';
import { BNB_CONCIERGE_WHATSAPP } from '@/lib/site/bnb';
import { cn } from '@/lib/utils/cn';

/**
 * "Chat with us": records the contact (reference code + campaign) before opening WhatsApp to the RumiaBnB team, so a
 * stay arranged in the chat is still credited to the post that brought the guest. Hidden when no number is set.
 */
export function ConciergeButton({
  listing = null,
  label = 'Chat with us on WhatsApp',
  variant = 'solid',
  className,
  checkIn = null,
  checkOut = null,
  guests = null,
}: {
  listing?: string | null;
  label?: string;
  variant?: 'solid' | 'amber' | 'outline' | 'link';
  className?: string;
  /** The guest's trip so far: written into the WhatsApp message. */
  checkIn?: string | null;
  checkOut?: string | null;
  guests?: number | null;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  if (!BNB_CONCIERGE_WHATSAPP) return null;

  async function open() {
    setBusy(true);
    setError(null);
    // Open the tab synchronously so pop-up blockers allow it, then point it at WhatsApp.
    const tab = window.open('', '_blank');
    try {
      const res = await staysApi.concierge(listing, attributionFor(), sessionId(), {
        check_in: checkIn && checkOut ? checkIn : null,
        check_out: checkIn && checkOut ? checkOut : null,
        guests: checkIn && checkOut && guests ? guests : null, // the count defaults to 1; only say it once dates are chosen
      });
      if (tab) tab.location.href = res.whatsapp_url;
      else window.location.href = res.whatsapp_url;
    } catch (e) {
      tab?.close();
      setError(e instanceof Error ? e.message : 'Could not open WhatsApp. Try again.');
    } finally {
      setBusy(false);
    }
  }

  const styles = {
    solid: 'bg-bnb-forest text-white hover:bg-bnb-pine',
    amber: 'bg-bnb-ink text-white hover:bg-black',
    outline: 'border border-bnb-ink bg-white text-bnb-ink hover:bg-bnb-mist',
    link: 'min-h-0 px-0 text-sm text-bnb-ink underline underline-offset-4 hover:text-bnb-forest',
  }[variant];

  return (
    <div className={className}>
      <button
        type="button"
        onClick={open}
        disabled={busy}
        className={cn(
          variant === 'link'
            ? 'inline-flex items-center justify-center gap-2 font-semibold transition-colors disabled:opacity-60'
            : 'inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-xl px-6 font-semibold transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-bnb-forest disabled:opacity-60 sm:w-auto',
          styles,
        )}
      >
        <MessageCircle className="h-4 w-4" aria-hidden />
        {busy ? 'Opening WhatsApp…' : label}
      </button>
      {error && (
        <p role="alert" className="mt-2 text-sm text-red-700">
          {error}
        </p>
      )}
    </div>
  );
}
