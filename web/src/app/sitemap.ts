import { MetadataRoute } from 'next';
import { publicApi } from '@/lib/api/public';

const BASE = process.env.NEXT_PUBLIC_APP_URL || 'https://rumia.co.ke';

export const revalidate = 86400;

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const { listings } = await publicApi
    .getSitemap({ revalidate })
    .catch(() => ({ listings: [], agents: [] }));

  const listingEntries: MetadataRoute.Sitemap = listings.map((l) => ({
    url: `${BASE}/p/${l.slug}`,
    lastModified: l.updated_at ? new Date(l.updated_at) : new Date(),
    changeFrequency: 'weekly',
    priority: 0.8,
  }));

  return [
    { url: BASE, lastModified: new Date(), changeFrequency: 'daily', priority: 1.0 },
    ...listingEntries,
  ];
}