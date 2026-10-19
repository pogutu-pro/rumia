'use client';

import { useState } from 'react';
import { useSearchParams } from 'next/navigation';

type Mode = 'login' | 'signup' | 'forgot';

const FIELD =
  'mt-1 h-12 w-full rounded-xl border border-bnb-line bg-white px-3 text-base text-bnb-ink focus:border-bnb-forest focus:outline-none focus:ring-2 focus:ring-bnb-forest/20';

/** Only same-host paths under /host, so a crafted link cannot send a host elsewhere after sign-in. */
function safeHostNext(raw: string | null): string {
  return raw && /^\/host(\/|\?|$)/.test(raw) && !raw.startsWith('//') ? raw : '/host';
}

/**
 * Email and password sign-in for hosts on the RumiaBnB host (the session is kept for this site). New accounts and
 * forgotten passwords are confirmed with a 6-digit emailed code, through the same routes as Rumia.
 */
export function HostSignIn() {
  const next = safeHostNext(useSearchParams().get('next'));
  const [mode, setMode] = useState<Mode>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [code, setCode] = useState('');
  const [codeSent, setCodeSent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ kind: 'error' | 'info'; text: string } | null>(null);

  function switchMode(m: Mode) {
    setMode(m);
    setPassword('');
    setCode('');
    setCodeSent(false);
    setMessage(null);
  }

  async function post(url: string, body: Record<string, unknown>) {
    const res = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || 'Something went wrong. Please try again.');
    return data;
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setMessage(null);
    try {
      if (mode === 'login') {
        await post('/auth/password/login', { email, password });
        window.location.assign(next);
        return;
      }
      if (!codeSent) {
        await post('/auth/email/start', mode === 'signup' ? { email, password } : { email });
        setCodeSent(true);
        if (mode === 'forgot') setPassword('');
        setMessage({ kind: 'info', text: `We emailed a 6-digit code to ${email}.` });
        setBusy(false);
        return;
      }
      await post('/auth/email/verify', mode === 'forgot' ? { email, code, new_password: password } : { email, code });
      window.location.assign(next);
    } catch (err) {
      setMessage({ kind: 'error', text: err instanceof Error ? err.message : 'Something went wrong. Please try again.' });
      setBusy(false);
    }
  }

  const title = mode === 'login' ? 'Host sign-in' : mode === 'signup' ? 'Create your host account' : 'Reset your password';
  const action = busy
    ? 'Please wait…'
    : mode === 'login'
      ? 'Sign in'
      : codeSent
        ? mode === 'signup'
          ? 'Confirm and sign in'
          : 'Save password and sign in'
        : mode === 'signup'
          ? 'Create account'
          : 'Email me a code';
  const showPassword = mode !== 'forgot' || codeSent;

  return (
    <div className="mx-auto max-w-md">
      <h1 className="font-bnb-display text-3xl font-bold tracking-tight text-bnb-ink">{title}</h1>
      <p className="mt-2 text-bnb-stone">
        {mode === 'signup'
          ? 'Use the email you will manage your place with. If we sent you an invite link, open it again after signing in.'
          : 'For hosts whose places are on RumiaBnB.'}
      </p>
      <form onSubmit={submit} className="mt-6 space-y-4">
        <label className="block text-sm font-medium text-bnb-stone">
          Email
          <input type="email" required autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} disabled={codeSent} className={FIELD} />
        </label>
        {codeSent && (
          <label className="block text-sm font-medium text-bnb-stone">
            6-digit code
            <input inputMode="numeric" pattern="[0-9]{6}" required autoComplete="one-time-code" value={code} onChange={(e) => setCode(e.target.value.trim())} className={FIELD} />
          </label>
        )}
        {showPassword && (
          <label className="block text-sm font-medium text-bnb-stone">
            {mode === 'forgot' ? 'New password' : 'Password'}
            <input
              type="password"
              required
              minLength={mode === 'login' ? 1 : 8}
              autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              disabled={mode === 'signup' && codeSent}
              className={FIELD}
            />
          </label>
        )}
        {message && (
          <p role={message.kind === 'error' ? 'alert' : 'status'} className={message.kind === 'error' ? 'rounded-xl bg-red-50 p-3 text-sm text-red-800' : 'text-sm text-bnb-stone'}>
            {message.text}
          </p>
        )}
        <button type="submit" disabled={busy} className="min-h-12 w-full rounded-full bg-bnb-forest px-6 font-semibold text-bnb-mist hover:bg-bnb-pine focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-bnb-amber disabled:opacity-60">
          {action}
        </button>
      </form>
      <div className="mt-6 flex flex-wrap gap-x-5 gap-y-2 text-sm">
        {mode !== 'login' && (
          <button type="button" onClick={() => switchMode('login')} className="font-semibold text-bnb-forest underline-offset-4 hover:underline">
            I have an account
          </button>
        )}
        {mode !== 'signup' && (
          <button type="button" onClick={() => switchMode('signup')} className="font-semibold text-bnb-forest underline-offset-4 hover:underline">
            Create an account
          </button>
        )}
        {mode !== 'forgot' && (
          <button type="button" onClick={() => switchMode('forgot')} className="font-semibold text-bnb-forest underline-offset-4 hover:underline">
            Forgot password
          </button>
        )}
      </div>
    </div>
  );
}
