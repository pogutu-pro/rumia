import { reportAuthFailure } from '@/lib/auth/report';
import { clientIpFrom, clientIpHeaders } from '@/lib/net/client-ip';
import { listingPath } from '@/lib/utils/listing-path';
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { getApiUrl } from '@/lib/api/config';
import { authBackend } from '@/lib/auth/backend';
import { AT_COOKIE, HINT_COOKIE, RT_COOKIE, isFresh, isRefreshRejected, sessionCookies, sessionFromToken } from '@/lib/auth/session';
import { BNB_ORIGIN, BNB_SITE_PREFIX, bnbRewritePath, isBnbHost, isBnbSitePath } from '@/lib/site/hosts';
import { BNB_REDIRECT_STATUS, BNB_SEPARATE, bnbRedirectFor } from '@/lib/site/separation';

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
       `connect-src 'self' http://localhost:* http://127.0.0.1:* ws://localhost:* ws://127.0.0.1:* https://rumia.co.ke https://www.rumia.co.ke ${BNB_ORIGIN} https://*.r2.cloudflarestorage.com https://maps.googleapis.com https://maps.gstatic.com https://places.googleapis.com https://vitals.vercel-insights.com https://*.i.posthog.com https://*.posthog.com https://cloudflareinsights.com https://static.cloudflareinsights.com https://*.sentry.io https://*.ingest.sentry.io https://*.ingest.de.sentry.io https://www.youtube.com https://*.youtube.com https://*.ytimg.com`,
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
 * - Keeps the session fresh (refresh-token exchange)
 * - 301 redirects /listing/[id] and /agent/[id] UUID paths to slug-based canonical URLs
 * - Protects /dashboard, /admin, /manager and /account routes
 * - Serves RumiaBnB on its own host by rewriting to the internal /bnb-site segment (see lib/site/hosts.ts)
 */
export default async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const requestHost = request.headers.get('x-forwarded-host') || request.headers.get('host');
  const onBnb = isBnbHost(requestHost);

  // The internal RumiaBnB segment is only reachable through the RumiaBnB host.
  if (!onBnb && isBnbSitePath(pathname)) {
    const res = new NextResponse('Not found', { status: 404 });
    applySecurityHeaders(res.headers);
    return res;
  }
  // On the RumiaBnB host the internal prefix is never part of a public URL: one address per page.
  if (onBnb && isBnbSitePath(pathname)) {
    // Built from the Host header: nextUrl can carry the server's own hostname behind the proxy.
    const proto = request.headers.get('x-forwarded-proto') || request.nextUrl.protocol.replace(':', '');
    const dest = new URL(`${pathname.slice(BNB_SITE_PREFIX.length) || '/'}${request.nextUrl.search}`, `${proto}://${requestHost}`);
    return NextResponse.redirect(dest, { status: 308 });
  }

  // Rumia-only legacy redirects.
  if (!onBnb) {
    // ── Short stays live on RumiaBnB (once separated): old Rumia short-stay URLs follow them ─────────────
    if (BNB_SEPARATE) {
      const dest = bnbRedirectFor(pathname, request.nextUrl.search);
      if (dest) return NextResponse.redirect(dest, { status: BNB_REDIRECT_STATUS });
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
      try {
        const res = await fetch(getApiUrl(`/listings/${id}`));
        if (res.ok) {
          const row = await res.json();
          if (row?.slug) {
            const dest = `${listingPath(row)}`;
            return NextResponse.redirect(new URL(dest, request.url), { status: 301 });
          }
        }
      } catch {}
    }

    // ── 301 permanent redirects for old UUID-based agent URLs ────────────────────
    const agentMatch = pathname.match(/^\/agent\/([0-9a-f-]{36})$/);
    if (agentMatch) {
      const id = agentMatch[1];
      try {
        const res = await fetch(getApiUrl(`/public/agents/${id}`));
        if (res.ok) {
          const row = await res.json();
          if (row?.slug) {
            return NextResponse.redirect(new URL(`/agents/${row.slug}`, request.url), { status: 301 });
          }
        }
      } catch {}
    }
  }

  // ── Auth protection ───────────────────────────────────────────────────────────
  const isProtectedRoute =
    pathname.startsWith('/dashboard') ||
    pathname.startsWith('/admin') ||
    pathname.startsWith('/manager') ||
    pathname.startsWith('/account');

  // ── Session refresh ───────────────────────────────────────────────────────────
  // The access token lives 30 min. When it is missing/near expiry but a refresh token exists,
  // exchange it here so Server Components see a valid session (they cannot set cookies).
  // Public pages without any session cookie cost nothing.
  let session = sessionFromToken(request.cookies.get(AT_COOKIE)?.value);
  let refreshed: ReturnType<typeof sessionCookies> | null = null;
  // The refresh endpoint was unreachable or throttled (not a rejection): keep the cookies and let
  // the browser retry via /auth/refresh instead of bouncing the user to the login page.
  let refreshUnavailable = false;
  const rt = request.cookies.get(RT_COOKIE)?.value;
  if (!isFresh(session) && rt) {
    const result = await authBackend.refresh(rt, clientIpFrom(request.headers)).catch(() => null);
    if (result?.ok && result.data) {
      refreshed = sessionCookies(result.data);
      session = sessionFromToken(result.data.access_token);
      // Make the new token visible to this very request's Server Components.
      for (const c of refreshed) request.cookies.set(c.name, c.value);
    } else if (result && isRefreshRejected(result.status)) {
      session = null; // refresh token revoked/expired: treat as signed out
    } else {
      refreshUnavailable = true;
      reportAuthFailure({ stage: 'refresh', cause: result ? `backend_${result.status}` : 'backend_unreachable', status: result?.status });
    }
  }
  const user = isFresh(session, 0) ? session!.user : null;

  const finish = (response: NextResponse) => {
    if (refreshed) {
      for (const c of refreshed) response.cookies.set(c.name, c.value, c.options);
    }
    applySecurityHeaders(response.headers);
    return response;
  };

  // RumiaBnB host: serve its own pages; the shared sign-in handlers pass through untouched.
  if (onBnb) {
    // The host dashboard needs a session on this host (cookies are per host); sign-in and invites stay open.
    const hostArea = pathname === '/host' || pathname.startsWith('/host/');
    const openHostPath = pathname === '/host/sign-in' || pathname === '/host/claim';
    if (hostArea && !openHostPath && !user && !refreshUnavailable) {
      const proto = request.headers.get('x-forwarded-proto') || request.nextUrl.protocol.replace(':', '');
      const login = new URL('/host/sign-in', `${proto}://${requestHost}`);
      login.searchParams.set('next', `${pathname}${request.nextUrl.search}`);
      return finish(NextResponse.redirect(login));
    }
    const target = bnbRewritePath(pathname);
    if (!target) return finish(NextResponse.next({ request: { headers: request.headers } }));
    const url = request.nextUrl.clone();
    url.pathname = target;
    return finish(NextResponse.rewrite(url, { request: { headers: request.headers } }));
  }

  if (!isProtectedRoute && !pathname.startsWith('/auth/login')) {
    return finish(NextResponse.next({ request: { headers: request.headers } }));
  }

  if (isProtectedRoute && !user && refreshUnavailable) {
    return finish(NextResponse.next({ request: { headers: request.headers } }));
  }

  // Redirect unauthenticated users away from protected routes
  if (isProtectedRoute && !user) {
    const loginUrl = new URL('/auth/login', request.url);
    const safePath =
      pathname.startsWith('/') && !pathname.startsWith('//')
        ? pathname
        : '/dashboard';
    loginUrl.searchParams.set('next', safePath);
    const redirect = NextResponse.redirect(loginUrl);
    if (rt && !refreshed) {
      for (const name of [AT_COOKIE, RT_COOKIE, HINT_COOKIE]) redirect.cookies.delete({ name, path: '/' });
    }
    return finish(redirect);
  }

  // If authenticated user visits /auth/login, let them through.
  // They may want to sign in with a different account (e.g. switch Google
  // accounts). The login page's own useEffect handles the redirect to
  // /account if they are already signed in and don't need to re-authenticate.

  return finish(NextResponse.next({ request: { headers: request.headers } }));
}

export const config = {
  matcher: [
    '/((?!api|_next/static|_next/image|favicon.png|sw.js|.*\\.(?:svg|png|jpg|jpeg|gif|webp|js|css|json|txt|xml|html|ico|mp3|webmanifest|woff2?)$).*)',
    // Per-host metadata files: RumiaBnB serves its own (the pattern above skips these extensions).
    '/sitemap.xml',
    '/robots.txt',
    '/manifest.webmanifest',
  ],
};
