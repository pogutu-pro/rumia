import { NextRequest, NextResponse } from 'next/server';
import { authBackend } from '@/lib/auth/backend';
import { sessionCookies } from '@/lib/auth/session';
import { safeNext } from '@/lib/auth/origin';
import { clientIpFrom, clientIpHeaders } from '@/lib/net/client-ip';
import { getApiUrl } from '@/lib/api/config';
import { profilesApi } from '@/lib/api/profiles';

/** Checks the emailed code, sets the session cookies and returns where to go next. */
export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null);
  const email = typeof body?.email === 'string' ? body.email : '';
  const code = typeof body?.code === 'string' ? body.code : '';
  const next = typeof body?.next === 'string' ? body.next : null;
  const ip = clientIpFrom(request.headers);

  const res = await authBackend.emailVerify(email, code, next, ip).catch(() => null);
  if (!res) return NextResponse.json({ error: 'server_unavailable' }, { status: 503 });
  if (!res.ok || !res.data) {
    const detail = (res.data as unknown as { message?: string; detail?: string } | null) ?? null;
    return NextResponse.json({ error: detail?.message || detail?.detail || 'That code did not work.' }, { status: res.status });
  }
  const session = res.data;

  let dest = safeNext(session.next);
  try {
    const sync = await profilesApi.syncLoginWithToken(session.access_token, {});
    if (sync.needs_profile_completion) dest = '/account';
  } catch (err) {
    console.error('[auth/email/verify] post-login sync failed', err);
  }

  // Saves made before signing in belong to the account now.
  const deviceId = request.cookies.get('rumia_did')?.value;
  if (deviceId) {
    await fetch(getApiUrl('/saves/merge'), {
      method: 'POST',
      headers: { Authorization: `Bearer ${session.access_token}`, 'X-Device-Id': deviceId, ...clientIpHeaders(ip) },
      cache: 'no-store',
    }).catch(() => null);
  }

  const response = NextResponse.json({ ok: true, next: dest });
  for (const c of sessionCookies(session)) response.cookies.set(c.name, c.value, c.options);
  return response;
}
