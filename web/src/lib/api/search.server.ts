/** Server-only half of `search.ts` (uses the session cookie via next/headers). Never import from client components. */
import { serverApi } from './server';
import { fetchPublicApi } from './config';
import type { Listing } from '@/types';
import type { PaginatedResponse } from './listings';
import type { SearchParams } from './search';

export const searchServerApi = {

  /**
   * Perform a text/filter search across listings (server-side, public data)
   * Uses a cookie-free fetch so pages can remain static/ISR.
   */
  searchServer: (params?: SearchParams) => {
    const searchParams = new URLSearchParams();
    if (params?.q) searchParams.set('q', params.q);
    if (params?.campus_slug) searchParams.set('campus_slug', params.campus_slug);
    if (params?.zone_slug) searchParams.set('zone_slug', params.zone_slug);
    if (params?.area) searchParams.set('area', params.area);
    if (params?.property_type) searchParams.set('property_type', params.property_type);
    if (params?.min_price) searchParams.set('min_price', params.min_price.toString());
    if (params?.max_price) searchParams.set('max_price', params.max_price.toString());
    if (params?.page) searchParams.set('page', params.page.toString());
    if (params?.limit) searchParams.set('limit', params.limit.toString());

    return fetchPublicApi<PaginatedResponse<Listing>>(`/search?${searchParams.toString()}`);
  }
};
