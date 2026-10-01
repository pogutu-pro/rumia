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
