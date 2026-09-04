import { api, serverApi } from './index';
import type { Campus } from '@/types';

export const campusesApi = {
  /**
   * List all campuses (client-side)
   */
  list: (statusFilter?: string) => {
    const params = new URLSearchParams();
    if (statusFilter) params.set('status', statusFilter);
    return api.get<Campus[]>(`/campuses?${params.toString()}`);
  },

  /**
   * List all campuses (server-side)
   */
  listServer: (statusFilter?: string) => {
    const params = new URLSearchParams();
    if (statusFilter) params.set('status', statusFilter);
    return serverApi.get<Campus[]>(`/campuses?${params.toString()}`);
  },

  /**
   * Get campus by slug (client-side)
   */
  getBySlug: (slug: string) => {
    return api.get<Campus>(`/campuses/${slug}`);
  },

  /**
   * Get campus by slug (server-side)
   */
  getBySlugServer: (slug: string) => {
    return serverApi.get<Campus>(`/campuses/${slug}`);
  }
};
