import { NextRequest, NextResponse } from 'next/server';
import { authBackend } from '@/lib/auth/backend';
import { clientIpFrom } from '@/lib/net/client-ip';
import { errorText } from '@/lib/auth/finish-sign-in';
import { safeNext } from '@/lib/auth/origin';

/** Emails a 6-digit code (plus a one-tap link for Rumia's sign-in page), or a code to reset a RumiaBnB host password. */
export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null);
  const email = typeof body?.email === 'string' ? body.email : '';
  const password = typeof body?.password === 'string' ? body.password : null;
  // Rumia's sign-in page asks for a one-tap link too; RumiaBnB host sign-up does not (its session lives on its host).
  const linkNext = body?.link === true ? safeNext(typeof body?.next === 'string' ? body.next : null) : null;
  const res = await authBackend.emailStart(email, password, clientIpFrom(request.headers), linkNext).catch(() => null);
  if (!res) return NextResponse.json({ error: 'Rumia could not reach the sign-in service. Please try again.' }, { status: 503 });
  if (res.ok) return NextResponse.json({ ok: true });
  return NextResponse.json({ error: errorText(res.data, 'Could not send the code.') }, { status: res.status });
}
