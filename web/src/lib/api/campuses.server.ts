/** Server-only half of `campuses.ts` (uses the session cookie via next/headers). Never import from client components. */
import { serverApi } from './server';
import { fetchPublicApi } from './config';
import type { Campus } from '@/types';

export const campusesServerApi = {

  /**
   * List all campuses (server-side)
   */
  listServer: (statusFilter?: string) => {
    const params = new URLSearchParams();
    if (statusFilter) params.set('status', statusFilter);
    return serverApi.get<Campus[]>(`/campuses?${params.toString()}`);
  },

  /**
   * Get campus by slug (server-side)
   */
  getBySlugServer: (slug: string) => {
    return serverApi.get<Campus>(`/campuses/${slug}`);
  }
};
