import { clientIpFrom, clientIpHeaders } from '@/lib/net/client-ip';
import { NextRequest, NextResponse } from 'next/server';
import { authBackend } from '@/lib/auth/backend';
import { CLEAR_COOKIES, RT_COOKIE } from '@/lib/auth/session';

export async function POST(request: NextRequest) {
  const rt = request.cookies.get(RT_COOKIE)?.value;
  if (rt) await authBackend.logout(rt, clientIpFrom(request.headers)).catch(() => null); // best effort; cookies are cleared regardless
  const res = new NextResponse(null, { status: 204 });
  for (const name of CLEAR_COOKIES) res.cookies.delete({ name, path: '/' });
  return res;
}
