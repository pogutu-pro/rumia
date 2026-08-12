import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { isAdminUser } from '@/lib/utils/admin';

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const isAdmin = await isAdminUser(supabase, user.id);
    if (!isAdmin) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const body = await request.json();
    const { name } = body;
    if (!name || typeof name !== 'string' || !name.trim()) {
      return NextResponse.json(
        { error: 'Missing campus name' },
        { status: 400 },
      );
    }

    const { createClient: createServiceClient } =
      await import('@supabase/supabase-js');
    const supabaseAdmin = createServiceClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
    );

    // Basic slugify
    const slug = name
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 50);

    const insertData = {
      name: name.trim(),
      slug,
      city: '',
      status: 'coming_soon',
      hero_headline: `Student Hostels Near ${name.trim()}`,
      whatsapp_number: '+254114845619',
      primary_color: '#10B981',
    } as any;

    const { data, error } = await supabaseAdmin
      .from('campuses')
      .insert(insertData)
      .select('id, name')
      .maybeSingle();

    if (error) {
      console.error('Create campus error:', error.message);
      return NextResponse.json(
        { error: 'Failed to create campus' },
        { status: 500 },
      );
    }

    return NextResponse.json({ success: true, campus: data });
  } catch (err) {
    console.error('Create campus exception:', err);
    return NextResponse.json(
      { error: 'Internal Server Error' },
      { status: 500 },
    );
  }
}
