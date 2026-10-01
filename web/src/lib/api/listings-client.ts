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
  sort?: 'newest' | 'views';
  /** Fetch specific listings (max 20), e.g. for the compare view. */
  ids?: string[];
}

export const listingsClientApi = {
  getFeed: (params?: ClientListingsFeedParams) => {
    const searchParams = new URLSearchParams();
    if (params?.page) searchParams.set('page', params.page.toString());
    if (params?.limit) searchParams.set('limit', params.limit.toString());
    if (params?.sort) searchParams.set('sort', params.sort);
    if (params?.ids?.length) searchParams.set('ids', params.ids.join(','));
    if (params?.has_video !== undefined) {
      searchParams.set('has_video', params.has_video.toString());
    }

    return api.get<PaginatedResponse<Listing>>(
      `/listings?${searchParams.toString()}`,
    );
  },
};
