import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { getPostHogClient } from '@/lib/posthog-server';

/**
 * Resolve the post-auth redirect target. Only allow same-origin relative
 * paths so a malformed/empty `next` can never bounce the user to an
 * unexpected page (e.g. the homepage).
 */
function safeNext(raw: string | null): string {
  const value = (raw ?? '').trim();
  if (
    value &&
    value.startsWith('/') &&
    !value.startsWith('//') &&
    !value.includes('://')
  ) {
    return value;
  }
  return '/account';
}

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get('code');
  const next = safeNext(searchParams.get('next'));

  if (!code) {
    // No code in the URL (e.g. the OAuth flow was interrupted or a stale
    // redirect landed here). Never bounce to the homepage — send the user
    // back to login so they can retry, or straight through if a session
    // already exists.
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll: () => request.cookies.getAll(),
          setAll: () => {},
        },
      },
    );
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (user) {
      return NextResponse.redirect(new URL(next, origin));
    }
    return NextResponse.redirect(
      new URL(`/auth/login?error=missing_code&next=${encodeURIComponent(next)}`, origin),
    );
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
    // Log the full error so the underlying cause is visible in server logs
    // while the user only ever sees the generic toast.
    console.error('[auth/callback] exchangeCodeForSession failed', {
      message: String(error.message).slice(0, 200),
      code: String((error as any).code ?? '').slice(0, 50),
      status: Number((error as any).status) || 0,
      name: String(error.name).slice(0, 50),
    });

    // The PKCE code verifier was likely missing (e.g. it got cleared while
    // the user was on the Google account chooser) or the code was already
    // used. Check for an existing session first so an authenticated user is
    // never bounced to the homepage; otherwise send them back to login.
    const {
      data: { user: existingUser },
    } = await supabase.auth.getUser();

    if (existingUser) {
      return NextResponse.redirect(new URL(next, origin));
    }

    // Capture the failure server-side with the exact exchange error code so
    // PKCE/session-establishment failures are measurable (device-dependence,
    // webview cookie loss, etc.) rather than a silent bounce to login.
    try {
      const ph = getPostHogClient();
      if (ph) {
        ph.capture({
          distinctId: 'oauth_callback',
          event: 'exchange_code_failed',
          properties: {
            code: String((error as any).code ?? '') || String(error.name),
            status: Number((error as any).status) || 0,
            next,
            ua: String(request.headers.get('user-agent') ?? '').slice(0, 120),
          },
        });
        await ph.flush().catch(() => {});
      }
    } catch (phErr) {
      // Analytics must never break the auth flow.
    }

    const isPkceError =
      String((error as any).code ?? '')
        .toLowerCase()
        .includes('pkce') ||
      String(error.message || '')
        .toLowerCase()
        .includes('pkce') ||
      String(error.name || '')
        .toLowerCase()
        .includes('session');

    return NextResponse.redirect(
      new URL(
        `/auth/login?error=${isPkceError ? 'pkce_failed' : 'auth_failed'}&next=${encodeURIComponent(next)}`,
        origin,
      ),
    );
  }

  // Sync Google profile metadata into the profiles table
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Ensure a profiles row exists for this user. This prevents client pages
  // from throwing when they expect a profile to exist (profile completion
  // modal flow relies on a profiles row). Use service-role `supabaseAdmin`
  // to upsert the minimal identifying fields.
  //
  // campus_id is NOT NULL on profiles. The on_auth_user_created_profile
  // trigger sets it to the DeKUT campus UUID, but we include it here as a
  // safety net so the upsert never fails with a NOT NULL violation if the
  // trigger is absent or fires after this code runs.
  if (user?.id) {
    try {
      // Check whether a profile already exists before deciding what to upsert.
      // For existing users we only update email; for new users we also stamp
      // campus_id / home_campus_id so the NOT NULL constraint is satisfied
      // even if the trigger hasn't fired yet.
      const { data: existingProfile } = await supabaseAdmin
        .from('profiles')
        .select('id, campus_id')
        .eq('id', user.id)
        .maybeSingle();

      if (existingProfile) {
        // Row exists — only sync email, never touch campus_id.
        await supabaseAdmin
          .from('profiles')
          .update({ email: user.email ? String(user.email).toLowerCase() : null })
          .eq('id', user.id);
      } else {
        // New user — fetch campus so we can satisfy the NOT NULL constraint.
        const { data: defaultCampus } = await supabaseAdmin
          .from('campuses')
          .select('id')
          .eq('slug', 'dekut')
          .maybeSingle();

        if (defaultCampus?.id) {
          const { error: upsertError } = await supabaseAdmin
            .from('profiles')
            .upsert(
              {
                id: user.id,
                email: user.email ? String(user.email).toLowerCase() : null,
                campus_id: defaultCampus.id,
                home_campus_id: defaultCampus.id,
              },
              { onConflict: 'id', ignoreDuplicates: true },
            );
          if (upsertError) {
            console.error('[auth/callback] profile upsert error', {
              message: String(upsertError.message).slice(0, 200),
              code: String((upsertError as any).code ?? '').slice(0, 50),
              userId: user.id,
            });
          }
        } else {
          // Campus lookup failed — the on_auth_user_created_profile trigger
          // should have already created the row. Log and skip; do not attempt
          // an insert without campus_id as it will violate NOT NULL.
          console.warn('[auth/callback] campus lookup returned null, skipping profile insert for', user.id);
        }
      }
    } catch (e) {
      console.error('[auth/callback] profile upsert exception', e);
    }
  }

  if (user?.user_metadata) {
    // Different OAuth providers may populate different metadata fields.
    const meta: any = user.user_metadata;
    const full_name = meta.full_name || meta.name || meta.given_name || null;
    const avatar_url = meta.avatar_url || meta.picture || null;

    if (full_name || avatar_url) {
      const updateData: Record<string, unknown> = {};
      if (full_name) updateData.full_name = full_name;
      if (avatar_url) updateData.avatar_url = avatar_url;

      // Use update (not upsert) — the profile row was already ensured above.
      const { error: profileError } = await supabaseAdmin
        .from('profiles')
        .update(updateData)
        .eq('id', user.id);

      if (profileError) {
        console.error('[auth/callback] profile metadata sync error', {
          message: String(profileError.message).slice(0, 200),
          userId: user.id,
        });
      }
    }
  }

  // Link any unlinked tour bookings to this user by matching phone number.
  // Also route students with an incomplete profile to /account so the
  // completion flow reliably re-prompts until they add a phone and confirm
  // their home university. Staff (agent/admin/manager) are exempt.
  if (user?.id) {
    try {
      const { data: profile } = await supabaseAdmin
        .from('profiles')
        .select('phone, role, home_campus_confirmed_at')
        .eq('id', user.id)
        .maybeSingle();

      const isStaff =
        !!profile?.role &&
        ['agent', 'admin', 'manager', 'super_admin'].includes(profile.role);

      if (
        !isStaff &&
        (!profile?.phone?.trim() || !profile?.home_campus_confirmed_at)
      ) {
        response.headers.set('location', new URL('/account', origin).toString());
        return response;
      }

      if (profile?.phone) {
        const normalizedPhone = profile.phone.replace(/\D/g, '');

        // Find tour bookings with matching phone that aren't linked yet
        const { data: unlinkedBookings } = await supabaseAdmin
          .from('tour_bookings')
          .select('id')
          .is('linked_user_id', null)
          .eq('phone', normalizedPhone)
          .limit(10);

        if (unlinkedBookings && unlinkedBookings.length > 0) {
          const bookingIds = unlinkedBookings.map((b: { id: string }) => b.id);
          await supabaseAdmin
            .from('tour_bookings')
            .update({ linked_user_id: user.id })
            .in('id', bookingIds);
        }
      }
    } catch (linkError) {
      // Non-critical: don't fail the auth flow if linking fails
      console.error('[auth/callback] tour booking link error', linkError);
    }
  }

  return response;
}
