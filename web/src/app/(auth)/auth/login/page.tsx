import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { SignInFlow } from '@/components/auth/sign-in-flow';
import { authBackend } from '@/lib/auth/backend';
import { safeNext } from '@/lib/auth/origin';
import { createClient } from '@/lib/auth/server';

export const metadata: Metadata = {
  title: 'Sign in',
  description: 'Sign in to Rumia with Google or a code sent to your email.',
  alternates: { canonical: '/auth/login' },
  robots: { index: false },
};

/** What a failed Google round-trip (see /auth/google/callback) means for the person, in their words. */
function errorMessage(code: string | undefined): string | null {
  switch (code) {
    case undefined:
    case '':
      return null;
    case 'access_denied':
      return 'You cancelled the Google sign-in. Try again whenever you are ready.';
    case 'oauth_state_expired':
    case 'missing_code':
      return 'The sign-in was interrupted or took too long. Please tap Continue with Google again.';
    case 'rate_limited':
      return 'Too many sign-in attempts right now. Please wait a minute and try again.';
    case 'server_unavailable':
      return 'Rumia could not reach the sign-in service. Please try again in a moment.';
    default:
      return 'Google could not sign you in. Please try again, or use your email.';
  }
}

export default async function LoginPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const params = await searchParams;
  const next = safeNext(params.next);

  // Already signed in (the proxy has refreshed the session if it could): go where they were heading.
  const { data } = await (await createClient()).auth.getUser();
  if (data.user) redirect(next);

  const methods = await authBackend.methods();
  return <SignInFlow next={next} methods={methods} initialError={errorMessage(params.error)} />;
}
