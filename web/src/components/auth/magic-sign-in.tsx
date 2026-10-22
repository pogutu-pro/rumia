'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { Loader2, MailWarning } from 'lucide-react';
import posthog from 'posthog-js';

/**
 * Lands from the "Sign in to Rumia" button in the code email. The email and code arrive in the URL fragment (never
 * sent to a server or a mail scanner), are removed from the address bar at once, and are posted to the same
 * /auth/email/verify route the code box uses, so a link works exactly once.
 */
export function MagicSignIn() {
  const [error, setError] = useState<string | null>(null);
  const started = useRef(false);

  useEffect(() => {
    if (started.current) return; // React strict mode runs effects twice in development
    started.current = true;

    const fields = new URLSearchParams(window.location.hash.slice(1));
    const email = fields.get('e') ?? '';
    const code = fields.get('c') ?? '';
    const next = fields.get('n') || '/account';
    history.replaceState(null, '', window.location.pathname); // keep the code out of history and screenshots

    if (!email || !/^\d{6}$/.test(code)) {
      // The fragment only exists in the browser, so this can only be known after mount.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setError('This sign-in link is incomplete. Open it again from the email, or sign in below.');
      return;
    }

    (async () => {
      try {
        const res = await fetch('/auth/email/verify', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email, code, next }),
        });
        const data = (await res.json().catch(() => ({}))) as { error?: string; next?: string };
        if (res.ok) {
          posthog.capture('magic_link_sign_in_completed');
          window.location.replace(data.next || next);
          return;
        }
        setError(data.error ?? 'This link did not work. It may have been used already or expired.');
      } catch {
        setError('You seem to be offline. Check your connection, then open the link again.');
      }
    })();
  }, []);

  if (!error) {
    return (
      <div className="flex flex-col items-center py-12 text-center" role="status">
        <Loader2 className="h-8 w-8 animate-spin text-primary" aria-hidden />
        <p className="mt-4 text-[15px] text-ink-muted">Signing you in…</p>
      </div>
    );
  }

  return (
    <div>
      <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-amber-50 text-amber-700">
        <MailWarning className="h-6 w-6" aria-hidden />
      </div>
      <h1 className="mt-5 text-[28px] font-semibold tracking-tight text-ink">Link not working</h1>
      <p role="alert" className="mt-1.5 text-[15px] leading-relaxed text-ink-muted">
        {error}
      </p>
      <Link
        href="/auth/login"
        className="mt-8 inline-flex h-12 w-full items-center justify-center rounded-xl bg-primary text-base font-semibold text-white hover:bg-primary/90"
      >
        Get a new link
      </Link>
    </div>
  );
}
