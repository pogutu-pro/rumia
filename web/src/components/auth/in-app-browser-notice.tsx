'use client';

import { useEffect, useState, useSyncExternalStore } from 'react';
import { Check, Copy, ExternalLink } from 'lucide-react';
import posthog from 'posthog-js';
import { chromeIntentUrl, detectInAppBrowser, type InAppBrowserInfo } from '@/lib/auth/in-app-browser';

/**
 * Google refuses sign-in inside the browsers built into WhatsApp, Instagram, Facebook and TikTok.
 * Rather than let the user hit a Google error page, say so up front and offer a way out.
 * Renders nothing in a normal browser.
 */
let cachedInfo: InAppBrowserInfo | null | undefined;

function readInfo(): InAppBrowserInfo | null {
  if (cachedInfo === undefined) {
    const detected = detectInAppBrowser(navigator.userAgent);
    cachedInfo = detected.isInApp ? detected : null;
  }
  return cachedInfo;
}

const subscribeNever = () => () => {};

export function InAppBrowserNotice() {
  // Server renders nothing; the browser reads its own user agent once after hydration.
  const info = useSyncExternalStore(subscribeNever, readInfo, () => null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (info) {
      posthog.capture('in_app_browser_sign_in_notice_shown', { app: info.app ?? 'unknown', platform: info.platform });
    }
  }, [info]);

  if (!info) return null;

  const where = info.app ? `${info.app}'s browser` : 'this in-app browser';

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      // Clipboard can be blocked in webviews; the instructions below still apply.
    }
  }

  return (
    <div role="note" className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-950">
      <p className="font-semibold">Google sign-in doesn&apos;t work inside {where}.</p>
      <p className="mt-1">
        Open Rumia in {info.platform === 'ios' ? 'Safari' : 'Chrome'} to continue.
      </p>
      <div className="mt-3 flex flex-wrap gap-2">
        {info.platform === 'android' && (
          <a
            href={chromeIntentUrl(typeof window === 'undefined' ? 'https://rumia.co.ke/auth/login' : window.location.href)}
            className="inline-flex min-h-11 items-center gap-1.5 rounded-lg bg-amber-900 px-4 text-sm font-semibold text-white"
          >
            <ExternalLink className="h-4 w-4" aria-hidden="true" />
            Open in Chrome
          </a>
        )}
        <button
          type="button"
          onClick={copyLink}
          className="inline-flex min-h-11 items-center gap-1.5 rounded-lg border border-amber-300 bg-white px-4 text-sm font-semibold text-amber-950"
        >
          {copied ? <Check className="h-4 w-4" aria-hidden="true" /> : <Copy className="h-4 w-4" aria-hidden="true" />}
          {copied ? 'Link copied' : 'Copy link'}
        </button>
      </div>
      {info.platform !== 'android' && (
        <p className="mt-2 text-xs">
          Paste the link into {info.platform === 'ios' ? 'Safari' : 'your browser'}, or use the ⋯ menu and choose &quot;Open in browser&quot;.
        </p>
      )}
    </div>
  );
}
