import { serverApi } from './server';
import { ApiError } from './client';
import type { CampusZone } from './zones';
import type { OfficialHostelsOverview } from './official-hostels';

export interface ManagerContextData {
  user_id: string;
  role: 'manager' | 'admin' | string;
  is_super_admin: boolean;
  managed_campus_id: string | null;
  managed_region_id: string | null;
  campus_name: string;
  user_name: string;
  user_email: string | null;
  has_agent_record: boolean;
}

export interface ManagerOverviewData {
  has_campuses: boolean;
  pending_applications: number;
  agents: number;
  listings: number;
  waiting_hostel_requests: number;
  official_hostels: number;
}

export interface CampusBrief {
  id: string;
  name: string;
  slug: string;
}

export interface ManagedApplication {
  id: string;
  user_id: string;
  campus_id: string;
  full_name: string;
  phone: string;
  id_number: string;
  hostel_name: string;
  relationship_to_hostel: string;
  owner_contact?: string | null;
  status: string;
  rejection_reason?: string | null;
  reviewed_by?: string | null;
  reviewed_at?: string | null;
  created_at: string;
  campus?: CampusBrief | null;
}

export interface ManagedAgent {
  id: string;
  user_id?: string | null;
  campus_id?: string | null;
  name: string;
  phone: string;
  whatsapp: string;
  status: string;
  verified?: boolean | null;
  is_featured?: boolean | null;
  is_founder?: boolean | null;
  slug?: string | null;
  created_at: string;
  campus?: CampusBrief | null;
}

export interface ManagedListing {
  id: string;
  slug?: string | null;
  title: string;
  price: number;
  location: string;
  area?: string | null;
  county?: string | null;
  campus_id?: string | null;
  is_active: boolean;
  verified: boolean;
  pays_commission: boolean;
  commission_locked_by_admin: boolean;
  landlord_phone?: string | null;
  created_at: string;
  images: { r2_url: string; display_order: number }[];
  agent?: { id: string; name: string; user_id?: string | null } | null;
  lead_count: number;
  campus?: CampusBrief | null;
}

export interface ManagerCampus {
  id: string;
  slug: string;
  name: string;
  city: string;
  status: 'active' | 'coming_soon' | 'suspended' | string;
  region_id?: string | null;
  phone?: string | null;
  email?: string | null;
  social_links?: Record<string, unknown> | null;
  whatsapp_number: string;
  hero_headline: string;
  hero_subtext?: string | null;
  hero_image?: string | null;
  primary_color: string;
  short_name?: string | null;
  seo_title?: string | null;
  seo_description?: string | null;
  og_title?: string | null;
  og_description?: string | null;
  twitter_description?: string | null;
  hostel_finding_fee?: number | null;
  consultation_fee?: number | null;
  feature_flags: Record<string, unknown>;
  created_at: string;
  [key: string]: unknown;
}

export type CampusSettingsPayload = Partial<
  Pick<
    ManagerCampus,
    | 'phone' | 'email' | 'social_links' | 'whatsapp_number' | 'hero_headline' | 'hero_subtext'
    | 'primary_color' | 'short_name' | 'hero_image' | 'seo_title' | 'seo_description' | 'og_title'
    | 'og_description' | 'twitter_description' | 'hostel_finding_fee' | 'consultation_fee'
    | 'name' | 'slug' | 'region_id' | 'status'
  >
>;

export interface StaffMemberData {
  id: string;
  full_name?: string | null;
  email?: string | null;
  role: string;
  managed_campus_id: string | null;
  managed_region_id: string | null;
}

async function nullOn(promise: Promise<any>, ...codes: number[]) {
  try {
    return await promise;
  } catch (error) {
    if (error instanceof ApiError && codes.includes(error.status)) return null;
    throw error;
  }
}

/** Server-side client for the manager console (scope + rules are enforced by FastAPI). */
export const managerApi = {
  /** The caller's manager context, or null when they are not a manager/admin. */
  context: (): Promise<ManagerContextData | null> =>
    nullOn(serverApi.get<ManagerContextData>('/manager/context'), 401, 403),

  overview: () => serverApi.get<ManagerOverviewData>('/manager/overview'),
  campuses: () => serverApi.get<ManagerCampus[]>('/manager/campuses'),
  createCampus: (data: { name: string; slug?: string; region_id?: string | null; hero_image?: string | null }) =>
    serverApi.post<ManagerCampus>('/manager/campuses', data),
  updateCampus: (id: string, data: CampusSettingsPayload) =>
    serverApi.patch<ManagerCampus>(`/manager/campuses/${id}`, data),

  applications: () => serverApi.get<ManagedApplication[]>('/manager/applications'),
  approveApplication: (id: string) => serverApi.post(`/manager/applications/${id}/approve`),
  rejectApplication: (id: string, reason: string) =>
    serverApi.post(`/manager/applications/${id}/reject`, { reason }),

  agents: () => serverApi.get<ManagedAgent[]>('/manager/agents'),
  setAgentStanding: (id: string, status: 'active' | 'suspended', suspension_reason?: string) =>
    serverApi.patch(`/manager/agents/${id}/standing`, { status, suspension_reason }),

  listings: () => serverApi.get<ManagedListing[]>('/manager/listings'),
  /** One in-scope listing for the edit form (404 when missing/out of scope). */
  getListing: (id: string) => nullOn(serverApi.get<any>(`/manager/listings/${id}`), 404),
  setOwnerPhone: (id: string, landlord_phone: string | null) =>
    serverApi.patch(`/manager/listings/${id}/owner-phone`, { landlord_phone }),
  hostels: () => serverApi.get<OfficialHostelsOverview>('/manager/hostels'),

  staff: () => serverApi.get<StaffMemberData[]>('/manager/staff'),
  findUser: (email: string) =>
    serverApi.get<{ id: string; email: string; full_name?: string | null }>(
      `/manager/staff/find?email=${encodeURIComponent(email)}`,
    ),
  searchAgents: (q: string) =>
    serverApi.get<{ id: string; email: string; full_name: string; campus_name: string }[]>(
      `/manager/staff/search-agents?q=${encodeURIComponent(q)}`,
    ),
  assignManager: (
    userId: string,
    scope: { managed_campus_id?: string | null; managed_region_id?: string | null },
  ) => serverApi.put<StaffMemberData>(`/manager/staff/${userId}`, scope),
  removeManager: (userId: string) => serverApi.delete(`/manager/staff/${userId}`),

  createZone: (campusId: string, name: string, fullSearchPrice: number, distanceCategory?: string | null) =>
    serverApi.post<CampusZone>('/zones', {
      campus_id: campusId,
      name,
      full_search_price: fullSearchPrice,
      distance_category: distanceCategory ?? null,
    }),
  updateZone: (id: string, name: string, fullSearchPrice: number, distanceCategory?: string | null) =>
    serverApi.patch<CampusZone>(`/zones/${id}`, {
      name,
      full_search_price: fullSearchPrice,
      distance_category: distanceCategory ?? null,
    }),
  deleteZone: (id: string) => serverApi.delete(`/zones/${id}`),
};
