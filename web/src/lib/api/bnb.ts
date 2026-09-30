import { api, serverApi, fetchPublicApi } from './index';
import type { PaginatedResponse } from './listings';

export interface BnbDetailsPayload {
  listing_type?: string;
  max_guests?: number | null;
  bedrooms?: number | null;
  bathrooms?: number | null;
  bed_config?: { type: string; qty: number }[];
  price_unit?: string;
  min_stay_nights?: number;
  max_stay_nights?: number | null;
  cleaning_fee?: number | null;
  security_deposit?: number | null;
  extra_guest_fee?: number | null;
  available_from?: string | null;
  available_until?: string | null;
  check_in_time?: string | null;
  check_out_time?: string | null;
  advance_notice_hours?: number | null;
  house_rules?: Record<string, unknown>;
  custom_rules?: string | null;
  guest_suitability?: string[];
  nearby_landmark?: string | null;
}

export interface BnbListingPayload {
  title: string;
  description: string;
  price: number;
  location: string;
  county?: string | null;
  area?: string | null;
  specific_location?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  amenities?: string[];
  is_active?: boolean;
  images?: Record<string, unknown>[];
  agent_whatsapp?: string | null;
  bnb: BnbDetailsPayload;
}

export interface BnbListingUpdatePayload
  extends Partial<BnbListingPayload>, BnbDetailsPayload {}

export const bnbApi = {
  create: (data: BnbListingPayload) => api.post<any>('/bnb', data),

  createServer: (data: BnbListingPayload) => serverApi.post<any>('/bnb', data),

  update: (id: string, data: BnbListingUpdatePayload) =>
    api.put<any>(`/bnb/${id}`, data),

  updateServer: (id: string, data: BnbListingUpdatePayload) =>
    serverApi.put<any>(`/bnb/${id}`, data),

  getById: (id: string) => api.get<any>(`/bnb/${id}`),

  getByIdServer: (id: string) => fetchPublicApi<any>(`/bnb/${id}`),

  getForEditServer: (id: string) => serverApi.get<any>(`/bnb/my/${id}`),

  getMyListings: (page = 1, limit = 20) =>
    serverApi.get<any>(`/bnb/my?page=${page}&limit=${limit}`),

  /** Public BnB feed — uses /bnb/public which includes bnb_details (server-side, cookie-free) */
  getPublicFeedServer: (params?: {
    page?: number;
    limit?: number;
    is_active?: boolean;
  }) => {
    const searchParams = new URLSearchParams();
    if (params?.page) searchParams.set('page', params.page.toString());
    if (params?.limit) searchParams.set('limit', params.limit.toString());
    return fetchPublicApi<PaginatedResponse<any>>(
      `/bnb/public?${searchParams.toString()}`,
    );
  },
};
