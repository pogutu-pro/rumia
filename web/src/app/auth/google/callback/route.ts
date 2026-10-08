import { clientIpFrom, clientIpHeaders } from '@/lib/net/client-ip';
import { getApiUrl } from '@/lib/api/config';
import { reportAuthFailure, errorCodeForStatus } from '@/lib/auth/report';
import { NextRequest, NextResponse } from 'next/server';
import { authBackend } from '@/lib/auth/backend';
import { STATE_COOKIE, sessionCookies } from '@/lib/auth/session';
import { getCanonicalOrigin, safeNext } from '@/lib/auth/origin';
import { profilesApi } from '@/lib/api/profiles';
import { getPostHogClient } from '@/lib/posthog-server';

function fail(origin: string, error: string, next?: string) {
  const url = new URL('/auth/login', origin);
  url.searchParams.set('error', error);
  if (next) url.searchParams.set('next', next);
  const res = NextResponse.redirect(url);
  res.cookies.delete({ name: STATE_COOKIE, path: '/auth/google' });
  return res;
}

export async function GET(request: NextRequest) {
  const origin = getCanonicalOrigin(request);
  const sp = request.nextUrl.searchParams;
  const code = sp.get('code');
  const state = sp.get('state');
  const googleError = sp.get('error');

  if (googleError) {
    const cancelled = googleError === 'access_denied';
    reportAuthFailure({ stage: 'google_error', cause: googleError, expected: cancelled });
    return fail(origin, cancelled ? 'access_denied' : 'auth_failed');
  }
  if (!code || !state) {
    reportAuthFailure({ stage: 'callback', cause: 'missing_code' });
    return fail(origin, 'missing_code');
  }

  // CSRF: the state must be the one we issued to this very browser.
  const stateCookie = request.cookies.get(STATE_COOKIE)?.value;
  if (stateCookie !== state) {
    reportAuthFailure({ stage: 'state_cookie', cause: stateCookie ? 'state_mismatch' : 'state_cookie_missing' });
    return fail(origin, 'oauth_state_expired');
  }

  let result;
  try {
    result = await authBackend.callback(code, state, clientIpFrom(request.headers));
  } catch (err) {
    console.error('[auth/google/callback] backend unreachable', err);
    reportAuthFailure({ stage: 'callback', cause: 'backend_unreachable' });
    return fail(origin, 'server_unavailable');
  }
  if (!result.ok || !result.data) {
    console.error('[auth/google/callback] backend rejected sign-in', result.status);
    reportAuthFailure({ stage: 'callback', cause: `backend_${result.status}`, status: result.status });
    try {
      const ph = getPostHogClient();
      ph?.capture({ distinctId: 'oauth_callback', event: 'exchange_code_failed', properties: { status: result.status } });
      await ph?.flush().catch(() => {});
    } catch {}
    return fail(origin, errorCodeForStatus(result.status));
  }
  const session = result.data;

  // Mobile: hand a one-time code to the app via its deep link; no web cookies are set.
  if (session.app_redirect && session.otc) {
    const target = new URL(session.app_redirect);
    target.searchParams.set('code', session.otc);
    const res = NextResponse.redirect(target.toString());
    res.cookies.delete({ name: STATE_COOKIE, path: '/auth/google' });
    return res;
  }

  let dest = safeNext(session.next);
  try {
    // Post-login sync also creates/refreshes the profile row on first sign-in.
    await profilesApi.syncLoginWithToken(session.access_token, {});
  } catch (syncError) {
    console.error('[auth/google/callback] post-login sync failed', syncError);
    reportAuthFailure({ stage: 'post_login_sync', cause: 'sync_failed' });
  }

  // Saves made before signing in belong to the account now.
  const deviceId = request.cookies.get('rumia_did')?.value;
  if (deviceId) {
    await fetch(getApiUrl('/saves/merge'), {
      method: 'POST',
      headers: { Authorization: `Bearer ${session.access_token}`, 'X-Device-Id': deviceId, ...clientIpHeaders(clientIpFrom(request.headers)) },
      cache: 'no-store',
    }).catch(() => null);
  }

  const response = NextResponse.redirect(new URL(dest, origin));
  for (const c of sessionCookies(session)) response.cookies.set(c.name, c.value, c.options);
  response.cookies.delete({ name: STATE_COOKIE, path: '/auth/google' });
  return response;
}
