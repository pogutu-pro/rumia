/** Server-only half of `tours.ts` (uses the session cookie via next/headers). Never import from client components. */
import { serverApi } from './server';
import { fetchPublicApi } from './config';
import type { TourBooking, MyTourBooking, TourBookingCreate, TourBookingStudentUpdate } from './tours';

export const toursServerApi = {

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

  updateStatusServer: (bookingId: string, status: string) => {
    return serverApi.patch<TourBooking>(`/tours/${bookingId}/status`, { status });
  },

  /** A student edits date/time/phone of their own pending booking. */
  updateMineServer: (bookingId: string, fields: TourBookingStudentUpdate) => {
    return serverApi.patch<TourBooking>(`/tours/${bookingId}`, fields);
  },

  /** Permanently delete a booking (the booking's agent or an admin). */
  deleteServer: (bookingId: string) => {
    return serverApi.delete<null>(`/tours/${bookingId}`);
  }
};
