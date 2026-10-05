import { NextRequest, NextResponse } from 'next/server';
import { authBackend } from '@/lib/auth/backend';
import { CLEAR_COOKIES, RT_COOKIE, isRefreshRejected, sessionCookies } from '@/lib/auth/session';

/** Same-origin only (SameSite=Lax cookie + POST). Exchanges the httpOnly refresh token. */
export async function POST(request: NextRequest) {
  const rt = request.cookies.get(RT_COOKIE)?.value;
  if (!rt) return NextResponse.json({ access_token: null }, { status: 401 });
  const result = await authBackend.refresh(rt).catch(() => null);
  if (!result) return NextResponse.json({ access_token: null }, { status: 503 }); // transient: keep cookies
  if (!result.ok && !isRefreshRejected(result.status)) {
    return NextResponse.json({ access_token: null }, { status: 503 }); // 429/5xx: transient, keep cookies
  }
  if (!result.ok || !result.data) {
    const res = NextResponse.json({ access_token: null }, { status: 401 });
    for (const name of CLEAR_COOKIES) res.cookies.delete({ name, path: '/' });
    return res;
  }
  const res = NextResponse.json({ access_token: result.data.access_token });
  for (const c of sessionCookies(result.data)) res.cookies.set(c.name, c.value, c.options);
  return res;
}
