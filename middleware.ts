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
      "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://maps.googleapis.com https://maps.gstatic.com https://apis.google.com",
      "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
      "font-src 'self' https://fonts.gstatic.com",
      "img-src 'self' data: blob: https: http:",
      "connect-src 'self' https://*.supabase.co wss://*.supabase.co https://*.r2.cloudflarestorage.com https://maps.googleapis.com https://maps.gstatic.com https://places.googleapis.com https://vitals.vercel-insights.com",
      "frame-src 'self' https://www.youtube.com",
      "object-src 'none'",
      "base-uri 'self'",
    ].join('; '),
  ],
];

function applySecurityHeaders(headers: Headers) {
  for (const [key, value] of SECURITY_HEADERS) {
    headers.set(key, value);
  }
}

/**
 * Middleware for Rumia Marketplace.
 * - Protects /dashboard and /admin routes
 * - 301 redirects /listing/[id] and /agent/[id] UUID paths to slug-based canonical URLs
 */
export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

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

  // If authenticated user visits /auth/login, redirect to account
  if (user && pathname.startsWith('/auth/login')) {
    const origin = new URL(request.url).origin;
    return NextResponse.redirect(new URL('/account', origin));
  }

  applySecurityHeaders(response.headers);
  return response;
}

export const config = {
  matcher: [
    '/((?!api|_next/static|_next/image|favicon.png|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
};
