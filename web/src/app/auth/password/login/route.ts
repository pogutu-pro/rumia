import { NextRequest, NextResponse } from 'next/server';
import { authBackend } from '@/lib/auth/backend';
import { clientIpFrom } from '@/lib/net/client-ip';
import { errorText, finishSignIn } from '@/lib/auth/finish-sign-in';

/** Email + password sign-in. */
export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null);
  const email = typeof body?.email === 'string' ? body.email : '';
  const password = typeof body?.password === 'string' ? body.password : '';
  const next = typeof body?.next === 'string' ? body.next : null;

  const res = await authBackend.passwordLogin(email, password, next, clientIpFrom(request.headers)).catch(() => null);
  if (!res) return NextResponse.json({ error: 'Rumia could not reach the sign-in service. Please try again.' }, { status: 503 });
  if (!res.ok || !res.data) return NextResponse.json({ error: errorText(res.data, 'Incorrect email or password') }, { status: res.status });
  return finishSignIn(request, res.data);
}
