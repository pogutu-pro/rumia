import { cache } from 'react';
import { announcementsApi } from '@/lib/api/announcements';
import type { PublicAnnouncement } from '@/types';

/**
 * Active announcements for a campus, fetched server-side for public pages.
 */
export const getActiveAnnouncements = cache(
  async (
    campusId: string | null | undefined,
  ): Promise<PublicAnnouncement[]> => {
    if (!campusId) return [];

    try {
      const data = await announcementsApi.listActiveServer(campusId);
      return data || [];
    } catch (error) {
      console.error('Failed to fetch announcements:', error);
      return [];
    }
  },
);
