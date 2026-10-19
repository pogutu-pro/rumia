/**
 * Two products, one app: requests for the RumiaBnB host are rewritten to the internal `/bnb-site` segment.
 *
 * `BNB_HOST` (server, runtime) lists the hostnames that serve RumiaBnB, comma-separated. Unset means RumiaBnB is off and
 * every request is Rumia, exactly as before. Moving RumiaBnB to its own domain later is a change of this value (plus a
 * 301 from the old host); no path changes.
 */

/** Internal path prefix of the RumiaBnB pages. Never public: on the Rumia host it answers 404. */
export const BNB_SITE_PREFIX = '/bnb-site';

/** Public origin of RumiaBnB, for canonical URLs, sitemaps and links from Rumia. */
export const BNB_ORIGIN = (process.env.NEXT_PUBLIC_BNB_ORIGIN || 'https://rumiabnb.rumia.co.ke').replace(/\/+$/, '');

/** Hostnames that serve RumiaBnB, lowercased, without ports. */
export function bnbHosts(raw: string | undefined = process.env.BNB_HOST): string[] {
  return (raw ?? '')
    .split(',')
    .map((h) => h.trim().toLowerCase().replace(/:\d+$/, ''))
    .filter(Boolean);
}

/** The request's host (first value of a proxy list), lowercased, without the port. */
export function normalizeHost(host: string | null | undefined): string {
  return (host ?? '').split(',')[0].trim().toLowerCase().replace(/:\d+$/, '');
}

export function isBnbHost(host: string | null | undefined, hosts: string[] = bnbHosts()): boolean {
  const h = normalizeHost(host);
  return h !== '' && hosts.includes(h);
}

/** True for `/bnb-site` and anything under it. */
export function isBnbSitePath(pathname: string): boolean {
  return pathname === BNB_SITE_PREFIX || pathname.startsWith(`${BNB_SITE_PREFIX}/`);
}

/**
 * Paths on the RumiaBnB host that are shared with Rumia and must not be rewritten: the sign-in route handlers
 * (Google, email, password, refresh, logout) and the PostHog proxy.
 */
const SHARED_PREFIXES = ['/auth/google/', '/auth/email/', '/auth/password/', '/auth/refresh', '/auth/logout', '/ingest/'];

/** Where a request on the RumiaBnB host is served from, or null when it is shared with Rumia as-is. */
export function bnbRewritePath(pathname: string): string | null {
  if (isBnbSitePath(pathname)) return pathname; // already internal (e.g. a client navigation that resolved it)
  if (SHARED_PREFIXES.some((p) => pathname === p.replace(/\/$/, '') || pathname.startsWith(p))) return null;
  return pathname === '/' ? BNB_SITE_PREFIX : `${BNB_SITE_PREFIX}${pathname}`;
}
