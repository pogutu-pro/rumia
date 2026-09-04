import { api } from './client';
import { serverApi } from './server';

export interface Review {
  id: string;
  listing_id: string;
  user_id: string;
  rating: number;
  text: string | null;
  stay_start?: string | null;
  stay_end?: string | null;
  status: string;
  author_name: string | null;
  author_avatar_url: string | null;
  created_at: string;
  updated_at?: string | null;
  rating_cleanliness?: number | null;
  rating_security?: number | null;
  rating_water?: number | null;
  rating_wifi?: number | null;
  rating_facilities?: number | null;
  rating_location?: number | null;
  rating_management?: number | null;
  rating_value?: number | null;
  like_count?: number;
  reply_count?: number;
}

export interface ReviewSummary {
  average_rating: number;
  total_reviews: number;
  distribution?: Record<string, number>;
  categories?: Record<string, number>;
}

export interface ReviewCreate {
  listing_id: string;
  rating: number;
  text?: string | null;
  stay_start?: string | null;
  stay_end?: string | null;
  rating_cleanliness?: number | null;
  rating_security?: number | null;
  rating_water?: number | null;
  rating_wifi?: number | null;
  rating_facilities?: number | null;
  rating_location?: number | null;
  rating_management?: number | null;
  rating_value?: number | null;
}

export interface ReviewUpdate {
  rating?: number;
  text?: string | null;
  rating_cleanliness?: number | null;
  rating_security?: number | null;
  rating_water?: number | null;
  rating_wifi?: number | null;
  rating_facilities?: number | null;
  rating_location?: number | null;
  rating_management?: number | null;
  rating_value?: number | null;
}

export const reviewsApi = {
  getFeed: (listingId?: string, status = 'published', page = 1, limit = 10) => {
    const params = new URLSearchParams({ status, page: page.toString(), limit: limit.toString() });
    if (listingId) params.set('listing_id', listingId);
    return api.get<{ items: Review[]; total: number }>(`/reviews?${params.toString()}`);
  },

  getFeedServer: (listingId?: string, status = 'published', page = 1, limit = 10) => {
    const params = new URLSearchParams({ status, page: page.toString(), limit: limit.toString() });
    if (listingId) params.set('listing_id', listingId);
    return serverApi.get<{ items: Review[]; total: number }>(`/reviews?${params.toString()}`);
  },

  getSummary: (listingId: string) => {
    return api.get<ReviewSummary>(`/reviews/summary/${listingId}`);
  },

  getSummaryServer: (listingId: string) => {
    return serverApi.get<ReviewSummary>(`/reviews/summary/${listingId}`);
  },

  create: (data: ReviewCreate) => {
    return api.post<Review>('/reviews', data);
  },

  createServer: (data: ReviewCreate) => {
    return serverApi.post<Review>('/reviews', data);
  },

  update: (id: string, data: ReviewUpdate) => {
    return api.put<Review>(`/reviews/${id}`, data);
  },

  updateServer: (id: string, data: ReviewUpdate) => {
    return serverApi.put<Review>(`/reviews/${id}`, data);
  },

  delete: (id: string) => {
    return api.delete(`/reviews/${id}`);
  },

  deleteServer: (id: string) => {
    return serverApi.delete(`/reviews/${id}`);
  },

  toggleLike: (id: string) => {
    return api.post<{ liked: boolean }>(`/reviews/${id}/like`);
  },

  toggleLikeServer: (id: string) => {
    return serverApi.post<{ liked: boolean }>(`/reviews/${id}/like`);
  },

  addReply: (id: string, text: string) => {
    return api.post(`/reviews/${id}/reply`, { text });
  },

  addReplyServer: (id: string, text: string) => {
    return serverApi.post(`/reviews/${id}/reply`, { text });
  },

  moderateServer: (id: string, action: string, note?: string) => {
    return serverApi.patch(`/reviews/${id}/moderate`, { action, note });
  },
};
