import { listingPath } from '@/lib/utils/listing-path';
import { BNB_SEPARATE } from '@/lib/site/separation';
import { MetadataRoute } from 'next';
import { publicApi } from '@/lib/api/public';
import { getAllCampuses } from '@/lib/data/campuses';
import { rumiaServer } from '@/lib/api/rumia';
import { KIND_PAGES, MIN_INDEXABLE, type KindPage } from '@/lib/seo/kinds';

const BASE = process.env.NEXT_PUBLIC_APP_URL || 'https://rumia.co.ke';

// Hourly, not daily: the area and landmark entries come from the API, and a sitemap built while the API was
// unreachable (a deploy, a build) must repair itself quickly instead of staying incomplete for a day.
export const revalidate = 3600;

/**
 * Market pages: the hub, each kind (hostels, bedsitters, apartments, short stays), each place, each place + kind, and each
 * landmark. A page with fewer than MIN_INDEXABLE places is `noindex`, so it stays out of the sitemap too.
 * Fails soft: the rest of the sitemap still ships.
 */
async function areaEntries(): Promise<MetadataRoute.Sitemap> {
  try {
    const api = rumiaServer({ revalidate });
    const markets = (await api.GET('/api/v1/markets')).data ?? [];
    const out: MetadataRoute.Sitemap = [];
    const count = async (market: string, place?: string, kind?: KindPage) =>
      (await api.GET('/api/v1/discovery/search', { params: { query: { market, place, limit: 1, ...(kind?.query ?? {}) } } })).data?.total ?? 0;
    const add = (path: string, priority: number) => out.push({ url: `${BASE}${path}`, changeFrequency: 'daily', priority });
    for (const m of markets) {
      const [places, landmarks] = await Promise.all([
        api.GET('/api/v1/markets/{market_slug}/places', { params: { path: { market_slug: m.slug } } }),
        api.GET('/api/v1/markets/{market_slug}/landmarks', { params: { path: { market_slug: m.slug } } }),
      ]);
      add(`/${m.slug}`, 0.95);
      const kindCounts = await Promise.all(KIND_PAGES.map((k) => count(m.slug, undefined, k)));
      KIND_PAGES.forEach((k, i) => { if (kindCounts[i] >= MIN_INDEXABLE) add(`/${m.slug}/${k.slug}`, 0.9); });
      for (const p of places.data ?? []) {
        const [total, ...perKind] = await Promise.all([count(m.slug, p.slug), ...KIND_PAGES.map((k) => count(m.slug, p.slug, k))]);
        if (total >= MIN_INDEXABLE) add(`/${m.slug}/${p.slug}`, 0.8);
        KIND_PAGES.forEach((k, i) => { if (perKind[i] >= MIN_INDEXABLE) add(`/${m.slug}/${k.slug}/${p.slug}`, 0.7); });
      }
      for (const l of landmarks.data ?? []) add(`/near/${m.slug}/${l.slug}`, 0.7);
    }
    return out;
  } catch {
    return [];
  }
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const campuses = await getAllCampuses();
  const areas = await areaEntries();

  const { listings, agents } = await publicApi
    .getSitemap({ revalidate })
    .catch(() => ({ listings: [], agents: [] }));

  const campusEntries: MetadataRoute.Sitemap = campuses
    .filter((c) => c.status === 'active')
    .map((c) => ({
      url: `${BASE}/hostels/${c.city.toLowerCase()}/${c.slug}`,
      lastModified: new Date(),
      changeFrequency: 'daily',
      priority: 0.95,
    }));

  // Short stays are in RumiaBnB's sitemap once the products are separated.
  const listingEntries: MetadataRoute.Sitemap = listings
    .filter((l) => !(BNB_SEPARATE && l.property_type === 'short_stay'))
    .map((l) => ({
    url: `${BASE}${listingPath(l)}`,
    lastModified: l.updated_at ? new Date(l.updated_at) : new Date(),
    changeFrequency: 'weekly',
    priority: 0.8,
  }));

  const agentEntries: MetadataRoute.Sitemap = agents.map((a) => ({
    url: `${BASE}/agents/${a.slug}`,
    lastModified: a.updated_at ? new Date(a.updated_at) : new Date(),
    changeFrequency: 'monthly',
    priority: 0.6,
  }));

  return [
    { url: BASE, lastModified: new Date(), changeFrequency: 'daily', priority: 1.0 },
    { url: `${BASE}/hostels`, lastModified: new Date(), changeFrequency: 'daily', priority: 0.9 },
    ...campusEntries,
    ...listingEntries,
    ...agentEntries,
    ...areas,
  ];
}
