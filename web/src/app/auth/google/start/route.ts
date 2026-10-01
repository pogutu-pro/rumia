import { NextRequest, NextResponse } from 'next/server';
import { authBackend } from '@/lib/auth/backend';
import { STATE_COOKIE, cookieSecure } from '@/lib/auth/session';
import { getCanonicalOrigin } from '@/lib/auth/origin';

export async function GET(request: NextRequest) {
  const origin = getCanonicalOrigin(request);
  const sp = request.nextUrl.searchParams;
  const res = await authBackend.start(sp.get('next'), sp.get('app_redirect')).catch(() => null);
  if (!res?.ok || !res.data) {
    return NextResponse.redirect(new URL('/auth/login?error=auth_failed', origin));
  }
  const response = NextResponse.redirect(res.data.url);
  // Binds the Google round-trip to this browser (CSRF); compared in the callback.
  response.cookies.set(STATE_COOKIE, res.data.state, {
    httpOnly: true, sameSite: 'lax', secure: cookieSecure(), path: '/auth/google', maxAge: 600,
  });
  return response;
}
