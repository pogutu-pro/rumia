import { clientIpHeaders } from '@/lib/net/client-ip';
import { serverApi } from './server';

export const analyticsApi = {
  /**
   * Server-only. Records a listing page view through FastAPI. Identity comes from the user's
   * JWT (forwarded from the session cookie) and the visitor fingerprint from the forwarded
   * client IP + user-agent; the backend decides whether the view counts (never admins/agents).
   */
  trackViewServer: (listingId: string, clientIp: string, userAgent: string) =>
    serverApi.post<{ inserted: boolean; dedupe?: string | null; reason?: string | null }>(
      '/analytics/track-view',
      { listing_id: listingId },
      { headers: { ...clientIpHeaders(clientIp), 'User-Agent': userAgent } },
    ),
};
