'use client';

import { useState } from 'react';
import { Check, Share2 } from 'lucide-react';
import { track } from '@/lib/events';

interface ShareButtonProps {
  title: string;
  text: string;
  path: string;
  listingId?: string;
  className?: string;
}

/** Native share sheet where it exists (phones), otherwise copy the link. The text carries price and area. */
export function ShareButton({ title, text, path, listingId, className = '' }: ShareButtonProps) {
  const [copied, setCopied] = useState(false);

  async function share() {
    const url = new URL(path, window.location.origin).toString();
    track('share_clicked', { surface: 'property', listingId, props: { via: typeof navigator.share === 'function' ? 'native' : 'copy' } });
    try {
      if (typeof navigator.share === 'function') {
        await navigator.share({ title, text, url });
        return;
      }
      await navigator.clipboard.writeText(`${text} ${url}`);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      // user dismissed the sheet, or clipboard blocked: nothing to do
    }
  }

  return (
    <button
      type="button"
      onClick={share}
      aria-label={copied ? 'Link copied' : 'Share this place'}
      className={`inline-flex h-11 min-w-11 items-center justify-center gap-1.5 rounded-full border border-rum-line bg-rum-raised px-3 text-sm font-medium text-rum-text hover:bg-rum-sunken ${className}`}
    >
      {copied ? <Check className="h-5 w-5" aria-hidden="true" /> : <Share2 className="h-5 w-5" aria-hidden="true" />}
      <span className="hidden sm:inline">{copied ? 'Copied' : 'Share'}</span>
    </button>
  );
}
