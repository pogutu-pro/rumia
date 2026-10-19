import type { MetadataRoute } from 'next';
import { BNB_ORIGIN } from '@/lib/site/hosts';
import { getStays } from '@/lib/site/bnb-api';
import { stayPath } from '@/lib/site/stay-format';

export const revalidate = 3600;

/** Served as /sitemap.xml on the RumiaBnB host (proxy.ts rewrites it to /bnb-site/sitemap.xml). */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const stays = await getStays();
  return [
    { url: `${BNB_ORIGIN}/`, changeFrequency: 'daily', priority: 1 },
    { url: `${BNB_ORIGIN}/stays`, changeFrequency: 'daily', priority: 0.8 },
    { url: `${BNB_ORIGIN}/hosts`, changeFrequency: 'monthly', priority: 0.5 },
    ...stays.map((s) => ({
      url: `${BNB_ORIGIN}${stayPath(s)}`,
      lastModified: s.updated_at ?? s.created_at,
      changeFrequency: 'weekly' as const,
      priority: 0.9,
    })),
  ];
}
