import { api } from './client';
import { serverApi } from './server';

export interface TourBooking {
  id: string;
  student_name: string;
  phone: string;
  listing_id?: string | null;
  zone: string;
  tour_type: 'specific_hostel' | 'full_search';
  amount: number;
  preferred_date: string;
  preferred_time: 'morning' | 'afternoon' | 'evening';
  status: string;
  linked_user_id?: string | null;
  agent_id?: string | null;
  contacted: boolean;
  created_at: string;
  updated_at?: string | null;
}

export interface TourBookingCreate {
  student_name: string;
  phone: string;
  listing_id?: string | null;
  zone: string;
  tour_type: 'specific_hostel' | 'full_search';
  amount: number;
  preferred_date: string;
  preferred_time: 'morning' | 'afternoon' | 'evening';
  agent_id?: string | null;
}

export const toursApi = {
  create: (data: TourBookingCreate) => {
    return api.post<TourBooking>('/tours', data);
  },

  createServer: (data: TourBookingCreate) => {
    return serverApi.post<TourBooking>('/tours', data);
  },

  listServer: (params?: { status?: string; page?: number; limit?: number }) => {
    const searchParams = new URLSearchParams();
    if (params?.status) searchParams.set('status', params.status);
    if (params?.page) searchParams.set('page', params.page.toString());
    if (params?.limit) searchParams.set('limit', params.limit.toString());
    return serverApi.get<{ items: TourBooking[]; total: number }>(`/tours?${searchParams.toString()}`);
  },

  getByIdServer: (bookingId: string) => {
    return serverApi.get<TourBooking>(`/tours/${bookingId}`);
  },

  updateStatusServer: (bookingId: string, status: string, contacted?: boolean) => {
    return serverApi.patch<TourBooking>(`/tours/${bookingId}/status`, { status, contacted });
  },
};
