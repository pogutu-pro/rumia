import { NextRequest, NextResponse } from 'next/server';
import { sessionCookies, type BackendSession } from '@/lib/auth/session';
import { safeNext } from '@/lib/auth/origin';
import { clientIpFrom, clientIpHeaders } from '@/lib/net/client-ip';
import { getApiUrl } from '@/lib/api/config';
import { profilesApi } from '@/lib/api/profiles';

/** Shared tail of the email sign-in routes: profile sync, merge saves made before sign-in, set the session cookies. */
export async function finishSignIn(request: NextRequest, session: BackendSession): Promise<NextResponse> {
  let dest = safeNext(session.next);
  try {
    const sync = await profilesApi.syncLoginWithToken(session.access_token, {});
    if (sync.needs_profile_completion) dest = '/account';
  } catch (err) {
    console.error('[auth/email] post-login sync failed', err);
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

  const response = NextResponse.json({ ok: true, next: dest });
  for (const c of sessionCookies(session)) response.cookies.set(c.name, c.value, c.options);
  return response;
}

/** The API's error text for the browser (never the raw body). */
export function errorText(data: unknown, fallback: string): string {
  const d = data as { message?: string; detail?: unknown } | null;
  if (d?.message) return d.message;
  return typeof d?.detail === 'string' ? d.detail : fallback;
}
