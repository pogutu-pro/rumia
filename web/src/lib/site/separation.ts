import { BNB_ORIGIN } from './hosts';

/**
 * Rumia and RumiaBnB as two products. With NEXT_PUBLIC_BNB_SEPARATE=true (build-time; set at RumiaBnB go-live):
 * short stays leave Rumia's discovery (home, /hostels, kind pages, videos, sitemap) and every Rumia short-stay URL
 * redirects to RumiaBnB. Rumia keeps one way in ("Short stays · RumiaBnB", /bnb). Unset: Rumia is exactly as before.
 * The listing records are not touched either way.
 */
export const BNB_SEPARATE = process.env.NEXT_PUBLIC_BNB_SEPARATE === 'true';

/**
 * Temporary (307) while the move is new, so browsers do not cache it and it can be rolled back; switch to 308 once
 * RumiaBnB has been stable for a couple of weeks.
 */
export const BNB_REDIRECT_STATUS: 307 | 308 = 307;

const SHORT_STAYS = 'short-stays';

export function bnbStayUrl(slug: string, search = ''): string {
  return `${BNB_ORIGIN}/stay/${encodeURIComponent(slug)}${search}`;
}

function withQuery(base: string, extra: Record<string, string>, search: string): string {
  const url = new URL(base);
  for (const [k, v] of Object.entries(extra)) url.searchParams.set(k, v);
  new URLSearchParams(search).forEach((v, k) => url.searchParams.set(k, v)); // keep utm_* and anything else
  return url.toString();
}

/**
 * Where a Rumia short-stay URL lives on RumiaBnB, or null for any other path. Pure (no lookups):
 *   /bnb                                   → RumiaBnB home
 *   /{market}/short-stays                  → /stays?where={market}
 *   /{market}/short-stays/{place}          → /stays?where={place}
 *   /{market}/short-stays/{place}/{name}   → /stay/{name}
 * /bnb/{id}, /p/{slug} and /listing/{id} need a lookup and redirect in their pages.
 */
export function bnbRedirectFor(pathname: string, search = ''): string | null {
  const parts = pathname.replace(/\/+$/, '').split('/').filter(Boolean).map((p) => decodeURIComponent(p));
  if (parts.length === 1 && parts[0] === 'bnb') return withQuery(`${BNB_ORIGIN}/`, {}, search);
  if (parts.length >= 2 && parts[1] === SHORT_STAYS && parts[0] !== 'bnb-site') {
    const [market, , place, name] = parts;
    if (name && parts.length === 4) return withQuery(bnbStayUrl(name), {}, search);
    if (parts.length === 3) return withQuery(`${BNB_ORIGIN}/stays`, { where: place.replace(/-/g, ' ') }, search);
    if (parts.length === 2) return withQuery(`${BNB_ORIGIN}/stays`, { where: market.replace(/-/g, ' ') }, search);
  }
  return null;
}
