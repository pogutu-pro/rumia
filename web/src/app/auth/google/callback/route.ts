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

  if (googleError) return fail(origin, googleError === 'access_denied' ? 'access_denied' : 'auth_failed');
  if (!code || !state) return fail(origin, 'missing_code');

  // CSRF: the state must be the one we issued to this very browser.
  if (request.cookies.get(STATE_COOKIE)?.value !== state) return fail(origin, 'oauth_state_expired');

  let result;
  try {
    result = await authBackend.callback(code, state);
  } catch (err) {
    console.error('[auth/google/callback] backend unreachable', err);
    return fail(origin, 'auth_failed');
  }
  if (!result.ok || !result.data) {
    console.error('[auth/google/callback] backend rejected sign-in', result.status);
    try {
      const ph = getPostHogClient();
      ph?.capture({ distinctId: 'oauth_callback', event: 'exchange_code_failed', properties: { status: result.status } });
      await ph?.flush().catch(() => {});
    } catch {}
    return fail(origin, 'auth_failed');
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
    const sync = await profilesApi.syncLoginWithToken(session.access_token, {});
    if (sync.needs_profile_completion) dest = '/account';
  } catch (syncError) {
    console.error('[auth/google/callback] post-login sync failed', syncError);
  }

  const response = NextResponse.redirect(new URL(dest, origin));
  for (const c of sessionCookies(session)) response.cookies.set(c.name, c.value, c.options);
  response.cookies.delete({ name: STATE_COOKIE, path: '/auth/google' });
  return response;
}
