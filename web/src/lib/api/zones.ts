import { api } from './client';

export interface CampusZone {
  id: string;
  campus_id: string;
  name: string;
  slug: string;
  distance_category?: string | null;
  full_search_price: number;
  created_at: string;
}

export const zonesApi = {
  /** Zones for one campus, or every campus when no id is given. Public. */
  list: (campusId?: string) => {
    const params = new URLSearchParams();
    if (campusId) params.set('campus_id', campusId);
    return api.get<CampusZone[]>(`/zones?${params.toString()}`);
  },
};
