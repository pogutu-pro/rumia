import { api, serverApi } from './index';
import type { Announcement, PublicAnnouncement } from '@/types';

export const announcementsApi = {
  /**
   * List active announcements (client-side)
   */
  listActive: (campusId?: string | null) => {
    const params = new URLSearchParams();
    if (campusId) params.set('campus_id', campusId);
    return api.get<PublicAnnouncement[]>(`/announcements?${params.toString()}`);
  },

  /**
   * List active announcements (server-side)
   */
  listActiveServer: (campusId?: string | null) => {
    const params = new URLSearchParams();
    if (campusId) params.set('campus_id', campusId);
    return serverApi.get<PublicAnnouncement[]>(`/announcements?${params.toString()}`);
  },

  /**
   * Create an announcement (Requires Manager/Admin auth)
   */
  create: (data: Partial<Announcement>) => {
    return api.post<Announcement>('/announcements', data);
  },

  /**
   * Delete an announcement (Requires Manager/Admin auth)
   */
  delete: (id: string) => {
    return api.delete(`/announcements/${id}`);
  }
};
