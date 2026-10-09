import { clientIpFrom } from '@/lib/net/client-ip';
import { NextRequest, NextResponse } from 'next/server';
import { analyticsApi } from '@/lib/api/analytics';
import { checkRateLimit } from '@/lib/rate-limiter';

function getClientIp(request: NextRequest) {
  return clientIpFrom(request.headers) || '127.0.0.1';
}

/**
 * Thin same-origin proxy. FastAPI decides whether a view counts (dedupes, and never counts
 * admins/agents); this route only forwards the session and visitor fingerprint. Always
 * answers 200 so a tracking hiccup never surfaces to the visitor.
 */
export async function POST(request: NextRequest) {
  try {
    const { listing_id } = await request.json();

    if (!listing_id) {
      return NextResponse.json({ error: 'Missing listing_id' }, { status: 400 });
    }

    const ip = getClientIp(request);
    if (!checkRateLimit(`listing-views:${ip}:${listing_id}`, 1, 10_000)) {
      return NextResponse.json({ success: true, skipped: true });
    }

    const data = await analyticsApi.trackViewServer(
      listing_id,
      ip,
      request.headers.get('user-agent') || '',
    );
    return NextResponse.json({ success: true, data });
  } catch (error) {
    console.error('Listing view route error:', error);
    return NextResponse.json({ success: false }, { status: 200 });
  }
}
