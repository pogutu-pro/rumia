import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { supabaseAdmin } from '@/lib/supabase/admin';

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get('code');
  const next = searchParams.get('next') ?? '/account';

  if (!code) {
    return NextResponse.redirect(new URL('/?error=missing_code', origin));
  }

  const response = NextResponse.redirect(new URL(next, origin));

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) => {
            request.cookies.set(name, value);
            response.cookies.set(name, value, options);
          });
        },
      },
    },
  );

  const { error } = await supabase.auth.exchangeCodeForSession(code);

  if (error) {
    console.error('OAuth callback error:', error.message);
    return NextResponse.redirect(new URL('/?error=auth_failed', origin));
  }

  // Sync Google profile metadata into the profiles table
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (user?.user_metadata) {
    const { full_name, avatar_url } = user.user_metadata;
    if (full_name || avatar_url) {
      const updateData: Record<string, string> = {};
      if (full_name) updateData.full_name = full_name;
      if (avatar_url) updateData.avatar_url = avatar_url;

      const { error: profileError } = await supabaseAdmin
        .from('profiles')
        .update(updateData)
        .eq('id', user.id);

      if (profileError) {
        console.error('Profile sync error:', profileError.message);
      }
    }
  }

  return response;
}
