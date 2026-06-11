import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { isAdminUser } from '@/lib/utils/admin';

async function sha256(value: string) {
  const encoder = new TextEncoder();
  const data = encoder.encode(value);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((byte) => byte.toString(16).padStart(2, '0')).join('');
}

function getClientIp(request: NextRequest) {
  return (
    request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    request.headers.get('x-real-ip') ||
    '127.0.0.1'
  );
}

export async function POST(request: NextRequest) {
  try {
    const { listing_id } = await request.json();

    if (!listing_id) {
      return NextResponse.json({ error: 'Missing listing_id' }, { status: 400 });
    }

    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    let userId: string | null = user?.id || null;
    let shouldSkipTracking = false;

    if (user) {
      const isAdmin = await isAdminUser(supabase, user.id);
      if (isAdmin) {
        shouldSkipTracking = true;
      }
    }

    if (userId) {
      const { data: agent } = await supabase
        .from('agents')
        .select('id')
        .eq('user_id', userId)
        .maybeSingle();

      if (agent) {
        shouldSkipTracking = true;
      }
    }

    if (shouldSkipTracking) {
      return NextResponse.json({ success: true, skipped: true });
    }

    const ip = getClientIp(request);
    const userAgent = request.headers.get('user-agent') || '';
    const ipHash = await sha256(`${ip}:${userAgent}`);

    const { data, error } = await supabase.rpc('track_listing_view', {
      p_listing_id: listing_id,
      p_user_id: userId,
      p_ip_hash: ipHash,
    });

    if (error) {
      console.error('Listing view tracking error:', error);
      return NextResponse.json({ success: false }, { status: 200 });
    }

    return NextResponse.json({ success: true, data });
  } catch (error) {
    console.error('Listing view route error:', error);
    return NextResponse.json({ success: false }, { status: 200 });
  }
}
