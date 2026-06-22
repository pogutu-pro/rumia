import { MetadataRoute } from 'next';
import { createClient } from '@/lib/supabase/server';

const BASE = process.env.NEXT_PUBLIC_APP_URL || 'https://www.rumia.co.ke';

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const supabase = await createClient();

  const [{ data: listings }, { data: agents }] = await Promise.all([
    supabase
      .from('listings')
      .select('slug, county, area, updated_at')
      .eq('is_active', true)
      .not('slug', 'is', null),
    supabase
      .from('agents')
      .select('slug, updated_at')
      .eq('status', 'active')
      .not('slug', 'is', null),
  ]);

  const listingEntries: MetadataRoute.Sitemap = (listings || []).map((l) => ({
    url: `${BASE}/hostels/${l.county || 'nyeri'}/${l.area || 'dekut'}/${l.slug}`,
    lastModified: l.updated_at ? new Date(l.updated_at) : new Date(),
    changeFrequency: 'weekly',
    priority: 0.8,
  }));

  const agentEntries: MetadataRoute.Sitemap = (agents || []).map((a) => ({
    url: `${BASE}/agents/${a.slug}`,
    lastModified: a.updated_at ? new Date(a.updated_at) : new Date(),
    changeFrequency: 'monthly',
    priority: 0.6,
  }));

  return [
    { url: BASE, lastModified: new Date(), changeFrequency: 'daily', priority: 1.0 },
    { url: `${BASE}/hostels`, lastModified: new Date(), changeFrequency: 'daily', priority: 0.9 },
    { url: `${BASE}/hostels/nyeri/dekut`, lastModified: new Date(), changeFrequency: 'daily', priority: 0.95 },
    ...listingEntries,
    ...agentEntries,
  ];
}
