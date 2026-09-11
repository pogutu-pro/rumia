import { api } from './client';
import type { Listing } from '@/types';

export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  limit: number;
}

export interface ClientListingsFeedParams {
  page?: number;
  limit?: number;
  has_video?: boolean;
}

export const listingsClientApi = {
  getFeed: (params?: ClientListingsFeedParams) => {
    const searchParams = new URLSearchParams();
    if (params?.page) searchParams.set('page', params.page.toString());
    if (params?.limit) searchParams.set('limit', params.limit.toString());
    if (params?.has_video !== undefined) {
      searchParams.set('has_video', params.has_video.toString());
    }

    return api.get<PaginatedResponse<Listing>>(
      `/listings?${searchParams.toString()}`,
    );
  },
};
