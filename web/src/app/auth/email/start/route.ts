import { NextRequest, NextResponse } from 'next/server';
import { authBackend } from '@/lib/auth/backend';
import { clientIpFrom } from '@/lib/net/client-ip';

/** Emails a 6-digit sign-in code. The browser only ever talks to this route, never the API directly. */
export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null);
  const email = typeof body?.email === 'string' ? body.email : '';
  const res = await authBackend.emailStart(email, clientIpFrom(request.headers)).catch(() => null);
  if (!res) return NextResponse.json({ error: 'server_unavailable' }, { status: 503 });
  if (res.ok) return NextResponse.json({ ok: true });
  const detail = (res.data as { message?: string; detail?: string } | null) ?? null;
  return NextResponse.json({ error: detail?.message || detail?.detail || 'Could not send the code.' }, { status: res.status });
}
