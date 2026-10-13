import { NextRequest, NextResponse } from 'next/server';
import { authBackend } from '@/lib/auth/backend';
import { clientIpFrom } from '@/lib/net/client-ip';
import { errorText, finishSignIn } from '@/lib/auth/finish-sign-in';

/** Confirms the emailed code (new account, or forgotten password with `new_password`) and signs the person in. */
export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null);
  const email = typeof body?.email === 'string' ? body.email : '';
  const code = typeof body?.code === 'string' ? body.code : '';
  const next = typeof body?.next === 'string' ? body.next : null;
  const newPassword = typeof body?.new_password === 'string' ? body.new_password : null;

  const res = await authBackend.emailVerify(email, code, next, newPassword, clientIpFrom(request.headers)).catch(() => null);
  if (!res) return NextResponse.json({ error: 'Rumia could not reach the sign-in service. Please try again.' }, { status: 503 });
  if (!res.ok || !res.data) return NextResponse.json({ error: errorText(res.data, 'That code did not work.') }, { status: res.status });
  return finishSignIn(request, res.data);
}
