import { NextRequest, NextResponse } from 'next/server';
import { authBackend } from '@/lib/auth/backend';
import { clientIpFrom } from '@/lib/net/client-ip';
import { errorText } from '@/lib/auth/finish-sign-in';

/** Emails a 6-digit code: to confirm a new account (a password is sent along) or to reset a forgotten password. */
export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null);
  const email = typeof body?.email === 'string' ? body.email : '';
  const password = typeof body?.password === 'string' ? body.password : null;
  const res = await authBackend.emailStart(email, password, clientIpFrom(request.headers)).catch(() => null);
  if (!res) return NextResponse.json({ error: 'Rumia could not reach the sign-in service. Please try again.' }, { status: 503 });
  if (res.ok) return NextResponse.json({ ok: true });
  return NextResponse.json({ error: errorText(res.data, 'Could not send the code.') }, { status: res.status });
}
