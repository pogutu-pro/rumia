'use client';

import { useEffect, useRef, useState } from 'react';
import { ArrowLeft, ExternalLink, Loader2, Mail } from 'lucide-react';
import posthog from 'posthog-js';
import { InAppBrowserNotice } from '@/components/auth/in-app-browser-notice';
import type { SignInMethods } from '@/lib/auth/backend';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const RESEND_SECONDS = 60;

// Webmail inboxes worth a one-tap shortcut on the "check your email" step.
const INBOXES: Record<string, { label: string; url: string }> = {
  'gmail.com': { label: 'Open Gmail', url: 'https://mail.google.com/mail/u/0/#search/rumia' },
  'googlemail.com': { label: 'Open Gmail', url: 'https://mail.google.com/mail/u/0/#search/rumia' },
  'outlook.com': { label: 'Open Outlook', url: 'https://outlook.live.com/mail/0/' },
  'hotmail.com': { label: 'Open Outlook', url: 'https://outlook.live.com/mail/0/' },
  'live.com': { label: 'Open Outlook', url: 'https://outlook.live.com/mail/0/' },
  'yahoo.com': { label: 'Open Yahoo Mail', url: 'https://mail.yahoo.com/' },
};

const FIELD =
  'h-12 w-full rounded-xl border border-slate-300 bg-white px-4 text-base text-ink placeholder:text-slate-400 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20 disabled:opacity-60';
const PRIMARY_BUTTON =
  'inline-flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-primary text-base font-semibold text-white transition-colors hover:bg-primary/90 disabled:opacity-60';

async function postJson(url: string, body: Record<string, unknown>) {
  let res: Response;
  try {
    res = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  } catch {
    return { ok: false, status: 0, data: { error: 'You seem to be offline. Check your connection and try again.' } };
  }
  const data = await res.json().catch(() => ({}));
  return { ok: res.ok, status: res.status, data: data as { error?: string; next?: string } };
}

/**
 * Sign in and sign up are one flow: Google, or a 6-digit code sent to your email. The server signs an existing
 * address in and creates the account for a new one, so nobody has to know which screen they belong on.
 */
export function SignInFlow({ next, methods, initialError }: { next: string; methods: SignInMethods; initialError: string | null }) {
  const [step, setStep] = useState<'start' | 'code'>('start');
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [error, setError] = useState<string | null>(initialError);
  const [busy, setBusy] = useState(false);
  const [googleBusy, setGoogleBusy] = useState(false);
  const [resendIn, setResendIn] = useState(0);

  useEffect(() => {
    if (resendIn <= 0) return;
    const timer = setTimeout(() => setResendIn((s) => s - 1), 1000);
    return () => clearTimeout(timer);
  }, [resendIn]);

  // Coming back with the browser's Back button restores this page from cache with the spinner still on.
  useEffect(() => {
    const reset = (e: PageTransitionEvent) => e.persisted && setGoogleBusy(false);
    window.addEventListener('pageshow', reset);
    return () => window.removeEventListener('pageshow', reset);
  }, []);

  async function sendCode(address = email) {
    const clean = address.trim().toLowerCase();
    if (!EMAIL_RE.test(clean)) {
      setError('Enter a valid email address.');
      return;
    }
    setError(null);
    setBusy(true);
    const res = await postJson('/auth/email/start', { email: clean });
    setBusy(false);
    // 429: a code already went out recently, so the code step is still the right place to be.
    if (res.ok || res.status === 429) {
      posthog.capture('email_code_requested');
      setEmail(clean);
      setCode('');
      setStep('code');
      setResendIn(RESEND_SECONDS);
      if (!res.ok) setError(res.data.error ?? 'Use the code we already sent you.');
      return;
    }
    setError(res.data.error ?? 'We could not send the email. Please try again, or continue with Google.');
  }

  async function verify(entered: string) {
    if (busy) return;
    setError(null);
    setBusy(true);
    const res = await postJson('/auth/email/verify', { email, code: entered, next });
    if (res.ok) {
      posthog.capture('email_sign_in_completed');
      window.location.assign(res.data.next || next);
      return; // keep the spinner while the next page loads
    }
    setBusy(false);
    setCode('');
    setError(res.data.error ?? 'That code did not work. Check the latest email.');
  }

  if (step === 'code') {
    return (
      <CodeStep
        email={email}
        code={code}
        busy={busy}
        error={error}
        resendIn={resendIn}
        onCodeChange={(value) => {
          setCode(value);
          if (error) setError(null);
          if (value.length === 6) void verify(value);
        }}
        onSubmit={() => void verify(code)}
        onResend={() => void sendCode()}
        onBack={() => {
          setStep('start');
          setError(null);
        }}
      />
    );
  }

  const googleHref = `/auth/google/start?next=${encodeURIComponent(next)}`;

  return (
    <div>
      <h1 className="text-[28px] font-semibold tracking-tight text-ink">Welcome to Rumia</h1>
      <p className="mt-1.5 text-[15px] text-ink-muted">Sign in or create your account. It takes a few seconds.</p>

      <div className="mt-8 space-y-4">
        <InAppBrowserNotice emailAvailable={methods.email} />

        {methods.google && (
          <a
            href={googleHref}
            onClick={(e) => {
              if (googleBusy) {
                e.preventDefault();
                return;
              }
              setGoogleBusy(true);
              posthog.capture('google_sign_in_initiated');
            }}
            aria-disabled={googleBusy}
            className="flex h-12 w-full items-center justify-center gap-3 rounded-xl border border-slate-300 bg-white text-base font-semibold text-ink transition-colors hover:bg-slate-50"
          >
            {googleBusy ? <Loader2 className="h-5 w-5 animate-spin text-ink-muted" /> : <GoogleMark />}
            {googleBusy ? 'Opening Google…' : 'Continue with Google'}
          </a>
        )}

        {methods.google && methods.email && (
          <div className="flex items-center gap-3 text-xs uppercase tracking-wide text-slate-400">
            <span className="h-px flex-1 bg-slate-200" />
            or
            <span className="h-px flex-1 bg-slate-200" />
          </div>
        )}

        {methods.email && (
          <form
            noValidate
            onSubmit={(e) => {
              e.preventDefault();
              void sendCode();
            }}
            className="space-y-3"
          >
            <div className="space-y-1.5">
              <label htmlFor="email" className="block text-sm font-medium text-ink">
                Email
              </label>
              <input
                id="email"
                name="email"
                type="email"
                inputMode="email"
                autoComplete="email"
                autoCapitalize="none"
                spellCheck={false}
                placeholder="you@example.com"
                value={email}
                onChange={(e) => {
                  setEmail(e.target.value);
                  if (error) setError(null);
                }}
                aria-invalid={!!error}
                aria-describedby={error ? 'sign-in-error' : undefined}
                className={FIELD}
              />
            </div>
            {error && <ErrorText id="sign-in-error">{error}</ErrorText>}
            <button type="submit" disabled={busy} className={PRIMARY_BUTTON}>
              {busy && <Loader2 className="h-4 w-4 animate-spin" />}
              Continue with email
            </button>
            <p className="text-center text-xs text-ink-muted">We will email you a 6-digit code. No password needed.</p>
          </form>
        )}

        {!methods.email && error && <ErrorText id="sign-in-error">{error}</ErrorText>}
      </div>
    </div>
  );
}

function CodeStep({
  email,
  code,
  busy,
  error,
  resendIn,
  onCodeChange,
  onSubmit,
  onResend,
  onBack,
}: {
  email: string;
  code: string;
  busy: boolean;
  error: string | null;
  resendIn: number;
  onCodeChange: (code: string) => void;
  onSubmit: () => void;
  onResend: () => void;
  onBack: () => void;
}) {
  const inbox = INBOXES[email.split('@')[1] ?? ''];
  const input = useRef<HTMLInputElement>(null);

  // Refocus after a wrong code so the next attempt can be typed straight away.
  useEffect(() => {
    if (!busy) input.current?.focus();
  }, [busy]);

  return (
    <div>
      <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10 text-primary">
        <Mail className="h-6 w-6" aria-hidden />
      </div>
      <h1 className="mt-5 text-[28px] font-semibold tracking-tight text-ink">Check your email</h1>
      <p className="mt-1.5 text-[15px] leading-relaxed text-ink-muted">
        We sent a 6-digit code to <span className="font-medium text-ink">{email}</span>. Enter it here.
      </p>

      <form
        noValidate
        onSubmit={(e) => {
          e.preventDefault();
          if (code.length === 6) onSubmit();
        }}
        className="mt-8 space-y-3"
      >
        <label htmlFor="code" className="sr-only">
          6-digit code
        </label>
        {/* One field, not six boxes: iPhone and Android offer the code from the email right above the keyboard. */}
        <input
          ref={input}
          id="code"
          name="code"
          inputMode="numeric"
          autoComplete="one-time-code"
          pattern="[0-9]*"
          maxLength={6}
          placeholder="••••••"
          value={code}
          disabled={busy}
          onChange={(e) => onCodeChange(e.target.value.replace(/\D/g, '').slice(0, 6))}
          aria-invalid={!!error}
          aria-describedby={error ? 'code-error' : undefined}
          className={`${FIELD} h-14 text-center font-mono text-2xl tracking-[0.5em]`}
        />
        {error && <ErrorText id="code-error">{error}</ErrorText>}
        <button type="submit" disabled={busy || code.length !== 6} className={PRIMARY_BUTTON}>
          {busy && <Loader2 className="h-4 w-4 animate-spin" />}
          {busy ? 'Signing you in…' : 'Continue'}
        </button>
      </form>

      {inbox && (
        <a
          href={inbox.url}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-3 inline-flex h-12 w-full items-center justify-center gap-1.5 rounded-xl border border-slate-300 text-base font-semibold text-ink hover:bg-slate-50"
        >
          {inbox.label}
          <ExternalLink className="h-4 w-4" aria-hidden />
        </a>
      )}

      <div className="mt-8 flex items-center justify-between border-t border-slate-100 pt-6 text-sm">
        <button type="button" onClick={onBack} className="inline-flex min-h-11 items-center gap-1.5 text-ink-muted hover:text-ink">
          <ArrowLeft className="h-4 w-4" aria-hidden /> Different email
        </button>
        <button
          type="button"
          onClick={onResend}
          disabled={resendIn > 0 || busy}
          className="min-h-11 font-medium text-primary hover:underline disabled:text-slate-400 disabled:no-underline"
        >
          {resendIn > 0 ? `Resend in ${resendIn}s` : 'Resend code'}
        </button>
      </div>
      <p className="mt-4 text-xs text-ink-muted">Not there? Check spam or promotions. The code works for 10 minutes.</p>
    </div>
  );
}

function ErrorText({ id, children }: { id: string; children: React.ReactNode }) {
  return (
    <p id={id} role="alert" className="text-sm text-red-600">
      {children}
    </p>
  );
}

function GoogleMark() {
  return (
    <svg className="h-5 w-5 shrink-0" viewBox="0 0 24 24" aria-hidden="true">
      <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4" />
      <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
      <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
      <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
    </svg>
  );
}
