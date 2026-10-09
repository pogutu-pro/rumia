import { listingPath } from '@/lib/utils/listing-path';
import { MetadataRoute } from 'next';
import { publicApi } from '@/lib/api/public';
import { getAllCampuses } from '@/lib/data/campuses';

const BASE = process.env.NEXT_PUBLIC_APP_URL || 'https://rumia.co.ke';

export const revalidate = 86400;

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const campuses = await getAllCampuses();

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

  const listingEntries: MetadataRoute.Sitemap = listings.map((l) => ({
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
  ];
}
