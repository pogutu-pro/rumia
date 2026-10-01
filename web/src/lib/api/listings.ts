import { api, serverApi, fetchPublicApi } from './index';
import type { Listing } from '@/types';

export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  limit: number;
}

export interface ListingsFeedParams {
  page?: number;
  limit?: number;
  campus_slug?: string;
  campus_id?: string;
  agent_id?: string;
  zone_slug?: string;
  county?: string;
  area?: string;
  property_type?: string;
  is_active?: boolean;
  sort?: 'views' | string;
  has_video?: boolean;
}

export const listingsApi = {
  /**
   * Fetches the listings feed (client-side)
   */
  getFeed: (params?: ListingsFeedParams) => {
    const searchParams = new URLSearchParams();
    if (params?.page) searchParams.set('page', params.page.toString());
    if (params?.limit) searchParams.set('limit', params.limit.toString());
    if (params?.campus_slug) searchParams.set('campus_slug', params.campus_slug);
    if (params?.campus_id) searchParams.set('campus_id', params.campus_id);
    if (params?.agent_id) searchParams.set('agent_id', params.agent_id);
    if (params?.zone_slug) searchParams.set('zone_slug', params.zone_slug);
    if (params?.county) searchParams.set('county', params.county);
    if (params?.area) searchParams.set('area', params.area);
    if (params?.property_type) searchParams.set('property_type', params.property_type);
    if (params?.is_active !== undefined) searchParams.set('is_active', params.is_active.toString());
    if (params?.sort) searchParams.set('sort', params.sort);
    if (params?.has_video !== undefined) searchParams.set('has_video', params.has_video.toString());

    return api.get<PaginatedResponse<Listing>>(`/listings?${searchParams.toString()}`);
  },

  /**
   * Fetches the listings feed (server-side, public data - for Next.js Server Components)
   * Uses a cookie-free fetch so pages can remain static/ISR.
   */
  getFeedServer: (params?: ListingsFeedParams) => {
    const searchParams = new URLSearchParams();
    if (params?.page) searchParams.set('page', params.page.toString());
    if (params?.limit) searchParams.set('limit', params.limit.toString());
    if (params?.campus_slug) searchParams.set('campus_slug', params.campus_slug);
    if (params?.campus_id) searchParams.set('campus_id', params.campus_id);
    if (params?.agent_id) searchParams.set('agent_id', params.agent_id);
    if (params?.zone_slug) searchParams.set('zone_slug', params.zone_slug);
    if (params?.county) searchParams.set('county', params.county);
    if (params?.area) searchParams.set('area', params.area);
    if (params?.property_type) searchParams.set('property_type', params.property_type);
    if (params?.is_active !== undefined) searchParams.set('is_active', params.is_active.toString());
    if (params?.sort) searchParams.set('sort', params.sort);
    if (params?.has_video !== undefined) searchParams.set('has_video', params.has_video.toString());

    return fetchPublicApi<PaginatedResponse<Listing>>(`/listings?${searchParams.toString()}`);
  },

  /**
   * Fetch a single listing by ID (client-side)
   */
  getById: (id: string) => {
    return api.get<Listing>(`/listings/${id}`);
  },

  /**
   * Fetch a single listing by ID/slug (server-side, public data)
   * Uses a cookie-free fetch so pages can remain static/ISR.
   */
  getByIdServer: (id: string) => {
    return fetchPublicApi<Listing>(`/listings/${id}`);
  },

  /** Fetch a listing with the current user's credentials for owner workflows. */
  getByIdAuthenticatedServer: (id: string) => {
    return serverApi.get<Listing>(`/listings/${id}`);
  },

  /**
   * Create a new listing (requires Auth) - Client side
   */
  create: (data: Partial<Listing>) => {
    return api.post<Listing>('/listings', data);
  },

  /**
   * Create a new listing (requires Auth) - Server side
   */
  createServer: (data: any) => {
    return serverApi.post<Listing>('/listings', data);
  },

  /**
   * Update a listing (requires Auth + Ownership/Admin) - Client side
   */
  update: (id: string, data: Partial<Listing>) => {
    return api.put<Listing>(`/listings/${id}`, data);
  },

  /**
   * Update a listing (requires Auth + Ownership/Admin) - Server side
   */
  updateServer: (id: string, data: any) => {
    return serverApi.put<Listing>(`/listings/${id}`, data);
  },

  /**
   * Toggle is_full status - Server side
   */
  toggleFullServer: (id: string, is_full: boolean) => {
    return serverApi.patch<Listing>(`/listings/${id}/toggle-full`, { is_full });
  },

  /**
   * Toggle is_active status - Server side
   */
  toggleActiveServer: (id: string, is_active: boolean) => {
    return serverApi.patch<Listing>(`/listings/${id}/toggle-active`, { is_active });
  },

  /**
   * Toggle pays_commission status - Server side
   */
  toggleCommissionServer: (id: string, pays_commission: boolean) => {
    return serverApi.patch<Listing>(`/listings/${id}/toggle-commission`, { pays_commission });
  },

  /**
   * Delete a listing (requires Auth + Ownership/Admin) - Client side
   */
  delete: (id: string) => {
    return api.delete(`/listings/${id}`);
  },

  /**
   * Delete a listing (requires Auth + Ownership/Admin) - Server side
   */
  deleteServer: (id: string) => {
    return serverApi.delete(`/listings/${id}`);
  }
};
