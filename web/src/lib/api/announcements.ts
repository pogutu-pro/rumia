import { api, serverApi } from './index';
import type { Announcement, PublicAnnouncement } from '@/types';
import type { CampusBrief } from './manager';

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

  /** Server-side create (Manager/Admin; FastAPI enforces campus scope). */
  createServer: (data: Partial<Announcement>) => {
    return serverApi.post<Announcement>('/announcements', data);
  },

  /** Server-side edit of an announcement for a campus you manage. */
  updateServer: (id: string, data: Partial<Announcement>) => {
    return serverApi.patch<Announcement>(`/announcements/${id}`, data);
  },

  deleteServer: (id: string) => {
    return serverApi.delete(`/announcements/${id}`);
  },

  /** All announcements (including expired) for the manager's campuses, with their campus. */
  listManagedServer: () => {
    return serverApi.get<(Announcement & { campus?: CampusBrief | null })[]>('/manager/announcements');
  },

  /**
   * Delete an announcement (Requires Manager/Admin auth)
   */
  delete: (id: string) => {
    return api.delete(`/announcements/${id}`);
  }
};
