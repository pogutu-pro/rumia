import type { NextRequest } from 'next/server';

/**
 * Canonical public origin, so internal Docker hostnames or proxy headers never leak into
 * user redirects.
 */
export function getCanonicalOrigin(request: NextRequest): string {
  if (process.env.NEXT_PUBLIC_SITE_URL) {
    try {
      return new URL(process.env.NEXT_PUBLIC_SITE_URL).origin;
    } catch {}
  }
  const host = request.headers.get('x-forwarded-host') || request.headers.get('host');
  const proto = request.headers.get('x-forwarded-proto') || 'https';
  if (host && !host.includes(':3000') && !host.includes('localhost') && !/^[0-9a-f]{12}/i.test(host)) {
    return `${proto}://${host}`;
  }
  return 'https://rumia.co.ke';
}

/** Only same-site relative paths. */
export function safeNext(raw: string | null | undefined): string {
  const value = (raw ?? '').trim();
  if (value.startsWith('/') && !value.startsWith('//') && !value.includes('://') && !value.includes('\\')) {
    return value;
  }
  return '/account';
}

/**
 * The OAuth state cookie is host-only and Google returns to the canonical origin, so a sign-in
 * started on any other host (e.g. www) cannot complete. Returns the URL to bounce to, or null when
 * the request is already on the canonical host.
 */
export function canonicalRedirectFor(requestHost: string | null, requestUrl: URL, canonicalOrigin: string): URL | null {
  if (!requestHost) return null;
  let canonical: URL;
  try {
    canonical = new URL(canonicalOrigin);
  } catch {
    return null;
  }
  const host = requestHost.split(',')[0].trim().toLowerCase();
  // Local dev, previews and the internal container hostname are left alone.
  if (!host || host === canonical.host.toLowerCase() || /^(localhost|127\.|\[::1\])/.test(host) || host.includes(':3000')) return null;
  if (host !== `www.${canonical.host.toLowerCase()}`) return null;
  return new URL(`${requestUrl.pathname}${requestUrl.search}`, canonical.origin);
}
