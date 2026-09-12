import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { createServerClient } from '@supabase/ssr';

const SECURITY_HEADERS: [string, string][] = [
  ['X-DNS-Prefetch-Control', 'on'],
  ['Strict-Transport-Security', 'max-age=63072000; includeSubDomains; preload'],
  ['X-Frame-Options', 'DENY'],
  ['X-Content-Type-Options', 'nosniff'],
  ['Referrer-Policy', 'strict-origin-when-cross-origin'],
  [
    'Content-Security-Policy',
    [
      "default-src 'self'",
      "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://maps.googleapis.com https://maps.gstatic.com https://apis.google.com https://*.posthog.com https://static.cloudflareinsights.com https://www.youtube.com https://*.youtube.com https://*.ytimg.com",
      "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
      "font-src 'self' https://fonts.gstatic.com",
      "img-src 'self' data: blob: https: http:",
       "connect-src 'self' http://localhost:* http://127.0.0.1:* ws://localhost:* ws://127.0.0.1:* https://rumia.co.ke https://www.rumia.co.ke https://*.supabase.co wss://*.supabase.co https://*.r2.cloudflarestorage.com https://maps.googleapis.com https://maps.gstatic.com https://places.googleapis.com https://vitals.vercel-insights.com https://*.i.posthog.com https://*.posthog.com https://cloudflareinsights.com https://static.cloudflareinsights.com https://*.sentry.io https://*.ingest.sentry.io https://*.ingest.de.sentry.io https://www.youtube.com https://*.youtube.com https://*.ytimg.com",
      "frame-src 'self' https://www.youtube.com",
      "object-src 'none'",
      "base-uri 'self'",
      "worker-src 'self' blob:",
    ].join('; '),
  ],
];

function applySecurityHeaders(headers: Headers) {
  for (const [key, value] of SECURITY_HEADERS) {
    headers.set(key, value);
  }
}

/**
 * Proxy (Next.js 16: formerly middleware.ts) for Rumia Marketplace.
 * Runs on the Node.js runtime before every matched request.
 * - Surfaces Supabase OAuth failures on the login page
 * - 301 redirects /listing/[id] and /agent/[id] UUID paths to slug-based canonical URLs
 * - Protects /dashboard, /admin, /manager and /account routes
 */
export default async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // ── Surface Supabase OAuth failures on the login page ───────────────────────
  // When Google OAuth fails server-side (e.g. `bad_oauth_state`), GoTrue
  // bounces the browser to the configured Site URL root with error params.
  // Catch those here and forward the user to the login page with a readable
  // message instead of leaving them stranded on a blank homepage.
  if (
    pathname !== '/auth/login' &&
    (request.nextUrl.searchParams.has('error_code') ||
      request.nextUrl.searchParams.get('error') === 'invalid_request')
  ) {
    const loginUrl = new URL('/auth/login', request.url);
    const isOauthStateExpired =
      request.nextUrl.searchParams.get('error_code') === 'bad_oauth_state' ||
      /state|expired|cannot be verified/i.test(
        request.nextUrl.searchParams.get('error_description') || '',
      );
    loginUrl.searchParams.set(
      'error',
      isOauthStateExpired ? 'oauth_state_expired' : 'oauth_failed',
    );
    loginUrl.searchParams.set('next', pathname);
    return NextResponse.redirect(loginUrl);
  }

  // ── 301 redirect /browse → /hostels ──────────────────────────────────────────
  if (pathname === '/browse') {
    const dest = new URL('/hostels', request.url);
    request.nextUrl.searchParams.forEach((v, k) => dest.searchParams.set(k, v));
    return NextResponse.redirect(dest, { status: 301 });
  }

  // ── 301 permanent redirects for old UUID-based listing URLs ──────────────────
  const listingMatch = pathname.match(/^\/listing\/([0-9a-f-]{36})$/);
  if (listingMatch) {
    const id = listingMatch[1];
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
    try {
      const res = await fetch(
        `${supabaseUrl}/rest/v1/listings?id=eq.${id}&select=slug,county,area&limit=1`,
        { headers: { apikey: supabaseKey, Authorization: `Bearer ${supabaseKey}` } }
      );
      if (res.ok) {
        const rows = await res.json();
        const row = rows[0];
        if (row?.slug) {
          const dest = `/hostels/${row.county || 'nyeri'}/${row.area || 'dekut'}/${row.slug}`;
          return NextResponse.redirect(new URL(dest, request.url), { status: 301 });
        }
      }
    } catch {}
  }

  // ── 301 permanent redirects for old UUID-based agent URLs ────────────────────
  const agentMatch = pathname.match(/^\/agent\/([0-9a-f-]{36})$/);
  if (agentMatch) {
    const id = agentMatch[1];
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
    try {
      const res = await fetch(
        `${supabaseUrl}/rest/v1/agents?id=eq.${id}&select=slug&limit=1`,
        { headers: { apikey: supabaseKey, Authorization: `Bearer ${supabaseKey}` } }
      );
      if (res.ok) {
        const rows = await res.json();
        const row = rows[0];
        if (row?.slug) {
          return NextResponse.redirect(new URL(`/agents/${row.slug}`, request.url), { status: 301 });
        }
      }
    } catch {}
  }

  // ── Auth protection ───────────────────────────────────────────────────────────
  const isProtectedRoute =
    pathname.startsWith('/dashboard') ||
    pathname.startsWith('/admin') ||
    pathname.startsWith('/manager') ||
    pathname.startsWith('/account');

  // Skip Supabase session refresh for public routes — only needed for
  // protected routes and the login redirect.  This removes ~1 round-trip
  // from every public page load.
  if (!isProtectedRoute && !pathname.startsWith('/auth/login')) {
    const response = NextResponse.next({ request: { headers: request.headers } });
    applySecurityHeaders(response.headers);
    return response;
  }

  // ── Auth-required routes ─────────────────────────────────────────────────────
  let response = NextResponse.next({
    request: { headers: request.headers },
  });

  // Create a Supabase client that can read/write cookies in the middleware
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
    }
  );

  // Refresh the session (important for Supabase Auth token rotation)
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Redirect unauthenticated users away from protected routes
  if (isProtectedRoute && !user) {
    const loginUrl = new URL('/auth/login', request.url);
    const safePath =
      pathname.startsWith('/') && !pathname.startsWith('//')
        ? pathname
        : '/dashboard';
    loginUrl.searchParams.set('next', safePath);
    return NextResponse.redirect(loginUrl);
  }

  // If authenticated user visits /auth/login, let them through.
  // They may want to sign in with a different account (e.g. switch Google
  // accounts). The login page's own useEffect handles the redirect to
  // /account if they are already signed in and don't need to re-authenticate.

  applySecurityHeaders(response.headers);
  return response;
}

export const config = {
  matcher: [
    '/((?!api|_next/static|_next/image|favicon.png|sw.js|.*\\.(?:svg|png|jpg|jpeg|gif|webp|js|css|json|txt|xml|html|ico|mp3|webmanifest|woff2?)$).*)',
  ],
};
