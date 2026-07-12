import { NextRequest, NextResponse } from 'next/server';
import { getUploadUrl, isConfigured } from '@/lib/r2/client';
import { createClient } from '@/lib/supabase/server';
import { ALLOWED_MIME_TYPES } from '@/lib/image/validate';

export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { searchParams } = new URL(request.url);
    const filename = searchParams.get('filename');
    const filetype = searchParams.get('filetype') || 'image/jpeg';

    if (!filename) {
      return NextResponse.json({ error: 'Missing filename parameter' }, { status: 400 });
    }

    if (!ALLOWED_MIME_TYPES.includes(filetype)) {
      return NextResponse.json({ error: 'File type not allowed' }, { status: 400 });
    }

    if (!isConfigured()) {
      return NextResponse.json({ error: 'Cloud storage is not configured properly.' }, { status: 500 });
    }

    const cleanFilename = filename.replace(/[^a-zA-Z0-9.-]/g, '_');
    const uniqueKey = `${user.id}/${Date.now()}-${cleanFilename}`;

    const uploadUrl = await getUploadUrl(uniqueKey, filetype);
    const publicUrl = `${(process.env.NEXT_PUBLIC_R2_PUBLIC_URL || '').replace(/\/$/, '')}/${uniqueKey}`;

    return NextResponse.json({ uploadUrl, publicUrl });
  } catch (error) {
    console.error('Error generating upload URL:', error);
    return NextResponse.json({ error: 'Failed to generate upload URL' }, { status: 500 });
  }
}
