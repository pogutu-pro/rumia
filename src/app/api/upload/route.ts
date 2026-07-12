import { NextRequest, NextResponse } from 'next/server';
import { getUploadUrl, isConfigured } from '@/lib/r2/client';
import { createClient } from '@/lib/supabase/server';

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { filename, contentType } = await req.json();

  if (!filename || !contentType) {
    return NextResponse.json({ error: 'filename and contentType are required' }, { status: 400 });
  }

  if (!isConfigured()) {
    return NextResponse.json({ error: 'Cloud storage is not configured.' }, { status: 500 });
  }

  const key = `${user.id}/${Date.now()}-${filename}`;
  const uploadUrl = await getUploadUrl(key, contentType);

  return NextResponse.json({ uploadUrl, key });
}
