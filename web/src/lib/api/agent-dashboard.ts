import { serverApi } from './server';
import { fetchPublicApi } from './config';
import { ApiError } from './client';
import type { CampusZone } from './zones';
import type { TourStatus, TourTimeWindow, TourType } from '@/types';

/** The signed-in agent's own record (private fields included). Mirrors FastAPI `AgentSelfRead`. */
export interface AgentSelf {
  id: string;
  user_id?: string | null;
  campus_id?: string | null;
  name: string;
  phone: string;
  whatsapp: string;
  slug?: string | null;
  status: 'active' | 'suspended' | string;
  suspension_reason?: string | null;
  commission_balance: number;
  pochi_la_biashara_number?: string | null;
  expected_name?: string | null;
  bio?: string | null;
  profile_photo_url?: string | null;
  cover_image_url?: string | null;
  service_areas?: string[] | null;
  languages?: string[] | null;
  helping_since?: number | null;
  instagram?: string | null;
  linkedin?: string | null;
  instagram_public?: boolean | null;
  linkedin_public?: boolean | null;
  portfolio_url?: string | null;
  verified?: boolean | null;
  is_featured?: boolean | null;
  is_founder?: boolean | null;
  is_support?: boolean | null;
  created_at: string;
}

export interface AgentDashboardSummary {
  agent: AgentSelf;
  has_payment_details: boolean;
  listing_count: number;
  active_listing_count: number;
  leads_this_month: number;
  total_leads: number;
  pending_tours: number;
  tour_earnings: number;
}

export interface AgentListing {
  id: string;
  title: string;
  price: number;
  location: string;
  area?: string | null;
  is_active: boolean;
  is_full: boolean;
  pays_commission: boolean;
  commission_locked_by_admin: boolean;
  lead_count: number;
  images: { r2_url: string; display_order: number }[];
}

export interface AgentLead {
  id: string;
  listing_id: string;
  agent_id: string;
  clicked_at: string;
  contact_type?: 'hostel_owner' | 'rumia_agent' | null;
  name?: string | null;
  phone?: string | null;
}

export interface StaffTour {
  id: string;
  student_name: string;
  phone: string;
  listing_id: string | null;
  zone: string;
  tour_type: TourType;
  amount: number;
  preferred_date: string;
  preferred_time: TourTimeWindow;
  status: TourStatus;
  linked_user_id: string | null;
  agent_id: string | null;
  contacted: boolean;
  created_at: string;
  updated_at: string;
  listing?: { id: string; title: string; area: string | null } | null;
  agent?: { id: string; name: string; whatsapp?: string | null; phone?: string | null } | null;
}

export interface ViewAnalyticsRow {
  listing_id: string;
  listing_title?: string | null;
  listing_slug?: string | null;
  county?: string | null;
  area?: string | null;
  today_count: number;
  week_count: number;
  month_count: number;
  all_time_count: number;
}

async function nullOn404<T>(promise: Promise<T>): Promise<T | null> {
  try {
    return await promise;
  } catch (error) {
    if (error instanceof ApiError && error.status === 404) return null;
    throw error;
  }
}

/** Server-side client for the agent dashboard (all data comes from FastAPI with the user's JWT). */
export const agentDashboardApi = {
  /** The signed-in user's agent record, or null when they are not an agent. */
  getSelf: () => nullOn404(serverApi.get<AgentSelf>('/agents/me')),

  /** Admins/managers get an agent record created on first visit; others get a 403. */
  ensure: () => serverApi.post<AgentSelf>('/agents/me/ensure'),

  summary: () => serverApi.get<AgentDashboardSummary>('/agents/me/dashboard'),

  listings: (propertyType?: 'hostel' | 'apartment' | 'short_stay') =>
    serverApi.get<AgentListing[]>(
      `/agents/me/listings${propertyType ? `?property_type=${propertyType}` : ''}`,
    ),

  leads: () =>
    serverApi.get<{ items: AgentLead[]; total: number }>('/leads?limit=1000'),

  tours: (sort: 'created_desc' | 'upcoming' | 'date_desc' = 'upcoming') =>
    serverApi.get<{ items: StaffTour[]; total: number }>(`/tours?limit=1000&sort=${sort}`),

  viewAnalytics: (agentId: string) =>
    serverApi.get<ViewAnalyticsRow[]>(`/analytics/agent/${agentId}`),

  /** Zones of a campus (public data). */
  zones: (campusId: string | null | undefined) =>
    campusId
      ? fetchPublicApi<CampusZone[]>(`/zones?campus_id=${campusId}`).catch(() => [] as CampusZone[])
      : Promise.resolve([] as CampusZone[]),
};
