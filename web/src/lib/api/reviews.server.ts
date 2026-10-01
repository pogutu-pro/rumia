/** Server-only half of `reviews.ts` (uses the session cookie via next/headers). Never import from client components. */
import { serverApi } from './server';
import { fetchPublicApi } from './config';
import type { Review, ReviewSummary, ReviewCreate, ReviewUpdate } from './reviews';

export const reviewsServerApi = {

  getFeedServer: (listingId?: string, status = 'published', page = 1, limit = 10) => {
    const params = new URLSearchParams({ status, page: page.toString(), limit: limit.toString() });
    if (listingId) params.set('listing_id', listingId);
    return serverApi.get<{ items: Review[]; total: number }>(`/reviews?${params.toString()}`);
  },

  getSummaryServer: (listingId: string) => {
    return serverApi.get<ReviewSummary>(`/reviews/summary/${listingId}`);
  },

  createServer: (data: ReviewCreate) => {
    return serverApi.post<Review>('/reviews', data);
  },

  updateServer: (id: string, data: ReviewUpdate) => {
    return serverApi.put<Review>(`/reviews/${id}`, data);
  },

  deleteServer: (id: string) => {
    return serverApi.delete(`/reviews/${id}`);
  },

  toggleLikeServer: (id: string) => {
    return serverApi.post<{ liked: boolean }>(`/reviews/${id}/like`);
  },

  addReplyServer: (id: string, text: string) => {
    return serverApi.post(`/reviews/${id}/reply`, { text });
  },

  /** `edit` changes only the text and keeps the status. */
  moderateServer: (
    id: string,
    action: 'approve' | 'hide' | 'flag' | 'restore' | 'edit',
    note?: string,
    text?: string,
  ) => {
    return serverApi.patch(`/reviews/${id}/moderate`, { action, note, text });
  },

  deleteReplyServer: (replyId: string) => {
    return serverApi.delete(`/reviews/replies/${replyId}`);
  }
};
