'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { campusesApi } from '@/lib/api/campuses';
import { signInWithGoogle, hasStoredSessionCookie } from '@/lib/supabase/auth';
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
        <div className="text-center space-y-2">
          <h1 className="text-3xl font-black text-slate-900 tracking-tight">
            Sign in
          </h1>
          <p className="text-sm text-slate-500 font-medium">
            Welcome back, or create an account to get started.
          </p>
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
            <Loader2 className="h-5 w-5 animate-spin text-slate-400" />
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

        <p className="text-center text-xs text-slate-400">
          Everyone — students, agents and administrators — signs in with Google.
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
