import { NextRequest, NextResponse } from 'next/server';
import { sessionCookies, type BackendSession } from '@/lib/auth/session';
import { safeNext } from '@/lib/auth/origin';
import { afterSignIn, SETUP_LATER_COOKIE } from '@/lib/auth/onboarding';
import { reportAuthFailure } from '@/lib/auth/report';
import { clientIpFrom, clientIpHeaders } from '@/lib/net/client-ip';
import { getApiUrl } from '@/lib/api/config';
import { profilesApi } from '@/lib/api/profiles';

/**
 * Shared tail of every web sign-in (Google callback and email code): profile sync, merge saves made before signing
 * in, and decide where to land. Returns the destination path.
 */
export async function prepareSignIn(request: NextRequest, session: BackendSession): Promise<string> {
  const next = safeNext(session.next);
  let needsSetup = false;
  try {
    const sync = await profilesApi.syncLoginWithToken(session.access_token, {});
    needsSetup = sync.needs_profile_completion;
  } catch (err) {
    // Sign-in still succeeds; the account page offers setup again.
    console.error('[auth] post-login sync failed', err);
    reportAuthFailure({ stage: 'post_login_sync', cause: 'sync_failed' });
  }

  const deviceId = request.cookies.get('rumia_did')?.value;
  if (deviceId) {
    await fetch(getApiUrl('/saves/merge'), {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${session.access_token}`,
        'X-Device-Id': deviceId,
        ...clientIpHeaders(clientIpFrom(request.headers)),
      },
      cache: 'no-store',
    }).catch(() => null);
  }

  return afterSignIn(next, needsSetup, !!request.cookies.get(SETUP_LATER_COOKIE)?.value);
}

export function setSessionCookies(response: NextResponse, session: BackendSession): NextResponse {
  for (const c of sessionCookies(session)) response.cookies.set(c.name, c.value, c.options);
  return response;
}

/** Email routes answer the page's fetch with JSON; the page then navigates to `next`. */
export async function finishSignIn(request: NextRequest, session: BackendSession): Promise<NextResponse> {
  const dest = await prepareSignIn(request, session);
  return setSessionCookies(NextResponse.json({ ok: true, next: dest }), session);
}

/** The API's error text for the browser (never the raw body). */
export function errorText(data: unknown, fallback: string): string {
  const d = data as { message?: string; detail?: unknown; error?: { message?: string } } | null;
  if (d?.message) return d.message;
  if (typeof d?.error?.message === 'string') return d.error.message;
  if (typeof (d?.detail as { message?: string })?.message === 'string') return (d!.detail as { message: string }).message;
  return typeof d?.detail === 'string' ? d.detail : fallback;
}
