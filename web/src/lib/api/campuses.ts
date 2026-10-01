import { api } from './client';
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
   * Get campus by slug (client-side)
   */
  getBySlug: (slug: string) => {
    return api.get<Campus>(`/campuses/${slug}`);
  }
};
