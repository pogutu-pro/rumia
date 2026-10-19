import type { MetadataRoute } from 'next';
import { BNB_ORIGIN } from '@/lib/site/hosts';

export const revalidate = 3600;

/** Served as /sitemap.xml on the RumiaBnB host (proxy.ts rewrites it to /bnb-site/sitemap.xml). */
export default function sitemap(): MetadataRoute.Sitemap {
  return [{ url: `${BNB_ORIGIN}/`, changeFrequency: 'daily', priority: 1 }];
}
