import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { profilesApi } from '@/lib/api/profiles';
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

/**
 * Resolve the canonical public site origin so internal Docker container hostnames
 * (e.g. ed5c6283fc0c:3000) or internal proxy headers never leak into user redirects.
 */
function getCanonicalOrigin(request: NextRequest): string {
  if (process.env.NEXT_PUBLIC_SITE_URL) {
    try {
      return new URL(process.env.NEXT_PUBLIC_SITE_URL).origin;
    } catch {}
  }
  const forwardedHost = request.headers.get('x-forwarded-host') || request.headers.get('host');
  const forwardedProto = request.headers.get('x-forwarded-proto') || 'https';
  if (
    forwardedHost &&
    !forwardedHost.includes(':3000') &&
    !forwardedHost.includes('localhost') &&
    !/^[0-9a-f]{12}/i.test(forwardedHost)
  ) {
    return `${forwardedProto}://${forwardedHost}`;
  }
  return 'https://rumia.co.ke';
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const origin = getCanonicalOrigin(request);
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
    } = await supabase.auth.getUser().catch(() => ({ data: { user: null } }));
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

  let error: { message?: string; name?: string; code?: string; status?: number } | null = null;
  try {
    const result = await supabase.auth.exchangeCodeForSession(code);
    error = result.error;
  } catch (err) {
    // A thrown exchange (network reset from the VPS, etc.) must never surface
    // as a 502 — treat it like any other exchange failure and bounce to login.
    console.error('[auth/callback] exchangeCodeForSession threw', err);
    error = err as { message?: string; name?: string; code?: string; status?: number };
  }

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
    } = await supabase.auth.getUser().catch(() => ({ data: { user: null } }));

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

  // Post-login bookkeeping (profile row, school verification from the verified token email,
  // provider name/avatar, guest tour-booking linking) lives in FastAPI. The session cookie was
  // only just set on the response, so pass the fresh access token explicitly.
  const {
    data: { session },
  } = await supabase.auth.getSession();
  const meta: Record<string, any> = session?.user?.user_metadata ?? {};

  if (session?.access_token) {
    try {
      const sync = await profilesApi.syncLoginWithToken(session.access_token, {
        full_name: meta.full_name || meta.name || meta.given_name || null,
        avatar_url: meta.avatar_url || meta.picture || null,
      });

      // Students with an incomplete profile are routed to /account so the completion flow
      // re-prompts until they add a phone and confirm their home university.
      if (sync.needs_profile_completion) {
        response.headers.set('location', new URL('/account', origin).toString());
        return response;
      }
    } catch (syncError) {
      // Never block sign-in on bookkeeping failures.
      console.error('[auth/callback] post-login sync failed', syncError);
    }
  }

  return response;
}
