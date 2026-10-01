import { api } from './client';

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

export interface MyTourBooking extends TourBooking {
  listing?: {
    id: string;
    title: string;
    area: string | null;
    county: string | null;
    slug: string | null;
    images: { r2_url: string; display_order: number }[];
  } | null;
}

export interface TourBookingCreate {
  student_name: string;
  phone: string;
  listing_id?: string | null;
  zone: string;
  /** Scopes the zone price to one campus; needed when a zone name exists on several. */
  campus_id?: string | null;
  tour_type: 'specific_hostel' | 'full_search';
  preferred_date: string;
  preferred_time: 'morning' | 'afternoon' | 'evening';
  agent_id?: string | null;
  from_listing?: boolean;
  // No `amount`: the server always prices the tour from the zone's configured price.
}

export interface TourBookingStudentUpdate {
  preferred_date?: string;
  preferred_time?: 'morning' | 'afternoon' | 'evening';
  phone?: string;
}

export const toursApi = {
  /** The signed-in student's own bookings, each with a brief of its listing. */
  listMine: (params?: { sort?: 'created_desc' | 'upcoming'; page?: number; limit?: number }) => {
    const searchParams = new URLSearchParams();
    if (params?.sort) searchParams.set('sort', params.sort);
    if (params?.page) searchParams.set('page', params.page.toString());
    if (params?.limit) searchParams.set('limit', params.limit.toString());
    return api.get<{ items: MyTourBooking[]; total: number }>(`/tours/me?${searchParams.toString()}`);
  },

  create: (data: TourBookingCreate) => {
    return api.post<TourBooking>('/tours', data);
  }
};
