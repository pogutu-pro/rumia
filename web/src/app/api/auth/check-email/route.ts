import { NextRequest, NextResponse } from 'next/server';
import { getApiUrl } from '@/lib/api/config';

/** Thin same-origin proxy to FastAPI (`GET /profiles/check-email`, rate-limited there). */
export async function GET(request: NextRequest) {
  const email = request.nextUrl.searchParams.get('email');

  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return NextResponse.json({ exists: false }, { status: 400 });
  }

  const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || '127.0.0.1';
  try {
    const res = await fetch(
      getApiUrl(`/profiles/check-email?email=${encodeURIComponent(email)}`),
      { headers: { 'X-Forwarded-For': ip }, cache: 'no-store' },
    );
    if (!res.ok) {
      return NextResponse.json({ exists: false }, { status: res.status === 429 ? 429 : 502 });
    }
    const { exists } = await res.json();
    return NextResponse.json({ exists: !!exists });
  } catch {
    return NextResponse.json({ exists: false }, { status: 502 });
  }
}
