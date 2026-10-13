'use client';

import { InAppBrowserNotice } from '@/components/auth/in-app-browser-notice';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { campusesApi } from '@/lib/api/campuses';
import { signInWithGoogle, hasStoredSessionCookie } from '@/lib/auth/actions';
import posthog from 'posthog-js';
import { toast } from 'sonner';
import { Loader2 } from 'lucide-react';
import { BrandedLoader } from '@/components/ui/branded-loader';

export default function LoginPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [comingCampuses, setComingCampuses] = useState<
    { id: string; name: string; slug: string }[]
  >([]);

  // Sign-in form state
  const [googleSigningIn, setGoogleSigningIn] = useState(false);

  // Email + password sign-in. Email codes are only for confirming a new account and for "forgot password".
  type Mode = 'login' | 'signup' | 'forgot';
  const [mode, setMode] = useState<Mode>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [code, setCode] = useState('');
  const [codeSent, setCodeSent] = useState(false);
  const [busy, setBusy] = useState(false);

  function switchMode(next: Mode) {
    setMode(next);
    setPassword('');
    setCode('');
    setCodeSent(false);
  }

  async function postJson(url: string, body: Record<string, unknown>) {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || 'Something went wrong. Please try again.');
    return data as { next?: string };
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    const next = getNextParam() || '/account';
    try {
      if (mode === 'login') {
        const data = await postJson('/auth/password/login', { email, password, next });
        posthog.capture('password_sign_in_completed');
        window.location.assign(data.next || '/account');
        return;
      }
      if (!codeSent) {
        // Sign up sends the chosen password along; forgot password just asks for a code.
        await postJson('/auth/email/start', mode === 'signup' ? { email, password } : { email });
        setCodeSent(true);
        setCode('');
        if (mode === 'forgot') setPassword('');
        toast.success('We emailed you a 6-digit code.');
        setBusy(false);
        return;
      }
      const data = await postJson(
        '/auth/email/verify',
        mode === 'forgot' ? { email, code, next, new_password: password } : { email, code, next },
      );
      posthog.capture(mode === 'signup' ? 'sign_up_completed' : 'password_reset_completed');
      window.location.assign(data.next || '/account');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Something went wrong. Please try again.');
      setBusy(false);
    }
  }

  const title = mode === 'login' ? 'Welcome back' : mode === 'signup' ? 'Create your account' : 'Reset your password';
  const subtitle =
    mode === 'login'
      ? 'Enter your credentials to access your account'
      : mode === 'signup'
        ? codeSent
          ? 'Enter the 6-digit code we emailed you to confirm your email'
          : 'Use your email and a password, then we confirm your email'
        : codeSent
          ? 'Enter the code we emailed you and choose a new password'
          : 'We will email you a code to reset your password';
  const submitLabel = busy
    ? 'Please wait…'
    : mode === 'login'
      ? 'Login'
      : codeSent
        ? mode === 'signup'
          ? 'Confirm and create account'
          : 'Reset password and sign in'
        : mode === 'signup'
          ? 'Create account'
          : 'Email me a code';
  const showPassword = mode !== 'forgot' || codeSent;
  const passwordLabel = mode === 'forgot' ? 'New password' : 'Password';

  function getNextParam(): string | undefined {
    const params = new URLSearchParams(window.location.search);
    return params.get('next') || undefined;
  }

  function errorDescriptionFor(error: string): string | null {
    if (error === 'interaction_required') {
      return 'Google could not complete the sign-in. Please try again.';
    }
    if (error === 'access_denied') {
      return 'You cancelled the Google sign-in.';
    }
    if (error === 'rate_limited') {
      return 'Too many sign-in attempts right now. Please wait a minute and try again.';
    }
    if (error === 'server_unavailable') {
      return 'Rumia could not reach the sign-in service. Please try again in a moment.';
    }
    return null;
  }

  useEffect(() => {
    (async () => {
      // Already authenticated — redirect to the account page. Use the
      // non-destructive cookie check: the middleware has already validated
      // /auth/login requests, so we only need a cheap guard here. Avoid
      // getSession() on this page because a failing token refresh signs the
      // session out and clears the PKCE code-verifier cookie, which would
      // break the Google OAuth flow the user is about to start.
      if (hasStoredSessionCookie()) {
        router.replace('/account');
        return;
      }

      const params = new URLSearchParams(window.location.search);
      const error = params.get('error');
      const errorCode = params.get('error_code');
      if (error) {
        const stateExpired =
          errorCode === 'bad_oauth_state' ||
          error === 'oauth_state_expired' ||
          /oauth state|not found or expired|invalid_state/i.test(
            String(params.get('error_description') || error),
          );
        if (error === 'missing_code') {
          toast.error('Sign-in was interrupted. Please try again.');
        } else if (error === 'pkce_failed') {
          toast.error(
            'Your browser did not keep the sign-in session. Please try again, or use a standard browser (Chrome/Safari) instead of an in-app browser.',
            { duration: 7000 },
          );
        } else if (stateExpired) {
          toast.error(
            'The sign-in session expired before it completed. Please tap the Google button again.',
            { duration: 6000 },
          );
        } else {
          toast.error(
            errorDescriptionFor(error) ||
              'Something went wrong while signing you in. Please try again.',
          );
        }
      }

      // Fetch "coming soon" campuses for display on the login sheet
      try {
        const campuses = await campusesApi.list('coming_soon');

        if (campuses) {
          setComingCampuses(campuses.slice(0, 10) as any);
        }
      } catch (e) {
        // ignore fetch errors — campus list is optional
      }

      setLoading(false);
    })();
  }, [router]);

  if (loading) {
    return (
      <div className="min-h-[80vh] flex items-center justify-center animate-fade-in" role="status" aria-live="polite" aria-busy="true">
        <BrandedLoader size={96} text="Checking your session" />
        <span className="sr-only">Checking your session</span>
      </div>
    );
  }

  // ── Unauthenticated: Show sign-in ────────────────────────────────────
  return (
    <div className="min-h-[80vh] flex items-center justify-center bg-slate-50/50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-6 bg-white p-8 sm:p-10 rounded-3xl border border-slate-100 shadow-xl">
        <div className="space-y-1.5">
          <h1 className="text-3xl font-black text-slate-900 tracking-tight">{title}</h1>
          <p className="text-sm text-slate-500 font-medium">{subtitle}</p>
        </div>

        <InAppBrowserNotice />

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <label htmlFor="email" className="block text-sm font-semibold text-slate-700">
              Email
            </label>
            <input
              id="email"
              type="email"
              autoComplete="email"
              required
              value={email}
              disabled={codeSent}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full h-12 px-4 rounded-xl border border-slate-200 bg-slate-50 text-sm focus:outline-none focus:ring-2 focus:ring-primary disabled:opacity-70"
            />
          </div>

          {codeSent && (
            <div className="space-y-1.5">
              <label htmlFor="code" className="block text-sm font-semibold text-slate-700">
                6-digit code
              </label>
              <input
                id="code"
                inputMode="numeric"
                autoComplete="one-time-code"
                maxLength={6}
                required
                value={code}
                onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
                placeholder="123456"
                className="w-full h-12 px-4 rounded-xl border border-slate-200 bg-slate-50 text-lg tracking-[0.4em] text-center focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </div>
          )}

          {showPassword && (
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label htmlFor="password" className="block text-sm font-semibold text-slate-700">
                  {passwordLabel}
                </label>
                {mode === 'login' && (
                  <button
                    type="button"
                    onClick={() => switchMode('forgot')}
                    className="text-xs font-semibold text-slate-500 hover:text-slate-900"
                  >
                    Forgot password?
                  </button>
                )}
              </div>
              <input
                id="password"
                type="password"
                autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
                required
                minLength={mode === 'login' ? undefined : 8}
                value={password}
                disabled={mode === 'signup' && codeSent}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full h-12 px-4 rounded-xl border border-slate-200 bg-slate-50 text-sm focus:outline-none focus:ring-2 focus:ring-primary disabled:opacity-70"
              />
              {mode !== 'login' && !codeSent && (
                <p className="text-[11px] text-slate-500">At least 8 characters.</p>
              )}
            </div>
          )}

          <button
            type="submit"
            disabled={busy || (codeSent && code.length !== 6)}
            className="w-full h-12 rounded-xl bg-primary text-white font-bold text-sm hover:bg-primary/90 transition-all disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {submitLabel}
          </button>

          {codeSent && (
            <button
              type="button"
              onClick={() => {
                setCodeSent(false);
                setCode('');
              }}
              className="w-full text-xs text-slate-500 hover:text-slate-800"
            >
              Use a different email or send a new code
            </button>
          )}
        </form>

        <div className="flex items-center gap-3 text-xs text-slate-400">
          <span className="h-px flex-1 bg-slate-200" />
          OR
          <span className="h-px flex-1 bg-slate-200" />
        </div>

{/* Google Sign-In — prominent */}
        <button
          onClick={() => {
            if (googleSigningIn) return;
            setGoogleSigningIn(true);
            posthog.capture('google_sign_in_initiated');
            signInWithGoogle(getNextParam() || '/account').finally(() => {
              setGoogleSigningIn(false);
            });
          }}
          disabled={googleSigningIn}
          className="w-full flex items-center justify-center gap-3 h-13 py-3.5 border-2 border-slate-200 rounded-xl font-semibold text-slate-800 hover:bg-slate-50 hover:border-slate-300 transition-all text-sm disabled:opacity-60 disabled:cursor-not-allowed"
        >
          {googleSigningIn ? (
            <Loader2 className="h-5 w-5 animate-spin text-slate-500" />
          ) : (
            <svg className="h-5 w-5 shrink-0" viewBox="0 0 24 24">
              <path
                d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z"
                fill="#4285F4"
              />
              <path
                d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                fill="#34A853"
              />
              <path
                d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                fill="#FBBC05"
              />
              <path
                d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                fill="#EA4335"
              />
            </svg>
          )}
          {googleSigningIn ? 'Redirecting to Google...' : 'Continue with Google'}
        </button>

        <p className="text-center text-sm text-slate-500">
          {mode === 'login' ? (
            <>
              Don&apos;t have an account?{' '}
              <button type="button" onClick={() => switchMode('signup')} className="font-bold text-slate-900 hover:underline">
                Sign up
              </button>
            </>
          ) : (
            <>
              Already have an account?{' '}
              <button type="button" onClick={() => switchMode('login')} className="font-bold text-slate-900 hover:underline">
                Login
              </button>
            </>
          )}
        </p>

        {comingCampuses.length > 0 && (
          <div className="mt-4">
            <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2 text-center">
              Coming soon campuses
            </h3>
            <div className="flex flex-wrap justify-center gap-2">
              {comingCampuses.map((c) => (
                <a
                  key={c.id}
                  href={`/?campus=${encodeURIComponent(c.slug)}`}
                  className="text-xs px-3 py-1.5 bg-slate-50 border border-slate-100 rounded-full text-slate-700 hover:bg-slate-100"
                >
                  {c.name}
                </a>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
