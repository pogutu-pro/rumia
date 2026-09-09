import { cache } from 'react';
import { fetchPublicApi } from '@/lib/api/config';

export interface CampusZone {
  id: string;
  campus_id: string;
  name: string;
  slug: string;
  distance_category?: string | null;
  full_search_price?: number;
}

const ZONE_CACHE_REVALIDATE = 300;

async function fetchZonesByCampusSlug(slug: string): Promise<CampusZone[]> {
  try {
    const zones = await fetchPublicApi<CampusZone[]>(`/zones?campus_slug=${slug}`);
    return zones || [];
  } catch (error) {
    console.error(`Failed to fetch zones for campus slug (${slug}):`, error);
    return [];
  }
}

export const getZonesByCampusSlug = cache(fetchZonesByCampusSlug);
