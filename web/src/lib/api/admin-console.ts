import { serverApi } from './server';

/** Server-side client for the admin console (every route is admin-only in FastAPI). */

export interface AdminOverviewData {
  active_listings: number;
  monthly_leads: number;
  pending_commissions_kes: number;
  active_agents: number;
  total_campuses: number;
  total_regions: number;
  total_managers: number;
  support_agents: number;
  official_hostels: number;
}

export interface AdminUserRowData {
  id: string;
  email: string;
  full_name: string | null;
  avatar_url: string | null;
  phone: string | null;
  role: string;
  created_at: string | null;
  updated_at: string | null;
  has_agent: boolean;
  agent_name: string | null;
  agent_status: string | null;
  agent_slug: string | null;
}

export interface AdminAgentRowData {
  id: string;
  name: string;
  phone: string;
  whatsapp: string;
  status: string;
  created_at: string;
  user_id: string;
  active_listings_count: number;
  total_leads_count: number;
  pending_commissions_sum: number;
  role: string;
  is_featured: boolean;
  is_founder: boolean;
}

interface TitleRef {
  id: string;
  title: string;
}
interface AgentOption {
  id: string;
  name: string;
  status?: string | null;
}

export interface AdminAgentDetailData {
  agent: {
    id: string;
    name: string;
    phone: string;
    whatsapp: string;
    status: string;
    verified: boolean;
    created_at: string;
    user_id: string | null;
    role: string | null;
  };
  listings: { id: string; title: string; location: string; price: number; is_active: boolean }[];
  leads: { id: string; clicked_at: string; listing_id: string; listings: TitleRef | null }[];
  commissions: {
    id: string;
    amount: number;
    status: string;
    created_at: string;
    paid_at: string | null;
    listing_id: string;
    listings: TitleRef | null;
  }[];
}

export interface AdminListingsPageData {
  listings: {
    id: string;
    title: string;
    location: string;
    price: number;
    is_active: boolean;
    verified: boolean;
    created_at: string;
    sort_position: number | null;
    leads_count: number;
    agent_name: string;
    agent_id: string;
    cover_image: string | null;
    landlord_phone: string | null;
    pays_commission: boolean;
    commission_locked_by_admin: boolean;
  }[];
  agents: AgentOption[];
  last_reorder_at: string | null;
  has_custom_order: boolean;
}

export interface AdminLeadsPageData {
  leads: {
    id: string;
    agent_id: string | null;
    listing_id: string | null;
    clicked_at: string;
    ip_hash: string | null;
    contact_type: string | null;
    name: string | null;
    phone: string | null;
    listings: TitleRef | null;
    agents: AgentOption | null;
  }[];
  agents: AgentOption[];
  listings: TitleRef[];
}

export interface ListingLeadsPageData {
  listing: {
    id: string;
    title: string;
    location: string;
    agent_id: string | null;
    agents: { id: string; name: string } | null;
  };
  leads: {
    id: string;
    name: string | null;
    phone: string | null;
    contact_type: string | null;
    clicked_at: string;
    agent_id: string | null;
  }[];
  agent_names: Record<string, string>;
}

export interface AdminCommissionsPageData {
  commissions: {
    id: string;
    agent_id: string | null;
    amount: number;
    status: 'pending' | 'paid' | string;
    created_at: string;
    paid_at: string | null;
    agents: AgentOption | null;
    listings: TitleRef | null;
  }[];
  agents: AgentOption[];
  total_pending: number;
  total_paid: number;
}

export interface TransferRowData {
  id: string;
  listing_id: string;
  previous_owner_id: string;
  new_owner_id: string;
  transferred_by: string;
  transferred_at: string;
  listing_title: string;
  previous_owner_name: string;
  new_owner_name: string;
}

export interface SupportAgentRowData {
  id: string;
  name: string;
  profile_photo_url: string | null;
  bio: string | null;
  verified: boolean;
  whatsapp: string;
  phone: string;
  slug: string | null;
  status: string;
  is_featured: boolean;
  is_founder: boolean;
  is_support: boolean;
  support_rank: number;
  is_owner: boolean;
}

export interface AdminAnalyticsData {
  summary: Record<string, number>;
  total_students: number;
  top_listings: any[];
  top_agents: any[];
}

export const adminConsoleApi = {
  overview: () => serverApi.get<AdminOverviewData>('/admin/overview'),
  users: () => serverApi.get<AdminUserRowData[]>('/admin/users'),
  changeRole: (userId: string, role: 'student' | 'agent') =>
    serverApi.patch(`/admin/users/${userId}/role`, { role }),
  promoteToAdmin: (userId: string) => serverApi.post(`/admin/users/${userId}/promote-admin`),

  agents: () => serverApi.get<AdminAgentRowData[]>('/admin/agents'),
  agentDetail: (id: string) => serverApi.get<AdminAgentDetailData>(`/admin/agents/${id}`),
  supportAgents: () => serverApi.get<SupportAgentRowData[]>('/admin/support-agents'),
  createAgent: (data: { name: string; phone: string; whatsapp: string }) =>
    serverApi.post<{ id: string; slug: string }>('/admin/agents', data),
  promoteStudent: (data: { user_id: string; name: string; phone: string; whatsapp: string }) =>
    serverApi.post<{ id: string; slug: string }>('/admin/agents/promote', data),
  patchAgent: (id: string, data: { name?: string; phone?: string; whatsapp?: string }) =>
    serverApi.patch(`/admin/agents/${id}`, data),
  setAgentFlags: (id: string, flags: { is_featured?: boolean; is_founder?: boolean; verified?: boolean }) =>
    serverApi.patch(`/admin/agents/${id}/flags`, flags),
  setAgentSupport: (id: string, fields: { is_support?: boolean; support_rank?: number; is_owner?: boolean }) =>
    serverApi.patch(`/admin/agents/${id}/support`, fields),
  agentVerification: (id: string) =>
    serverApi.get<{ verified: boolean; matched_hostels: string[]; shared_contact_detected: boolean }>(
      `/admin/agents/${id}/verification`,
    ),
  setAgentStanding: (id: string, status: 'active' | 'suspended', suspension_reason?: string) =>
    serverApi.patch(`/admin/agents/${id}/standing`, { status, suspension_reason }),

  listingsPage: () => serverApi.get<AdminListingsPageData>('/admin/listings'),
  reorder: (updates: { id: string; sort_position: number | null }[]) =>
    serverApi.put('/admin/listings/order', { updates }),
  shuffle: () => serverApi.post('/admin/listings/shuffle'),
  verifyListing: (id: string) =>
    serverApi.post<{ verified: boolean; match_type: string; matched_hostel: string | null; flags: string[] }>(
      `/admin/listings/${id}/verify`,
    ),
  verifyAll: () =>
    serverApi.post<{
      total: number;
      matched: number;
      phone_verified: number;
      name_review: number;
      no_match: number;
      shared_contacts: number;
      official_no_listing: number;
    }>('/admin/listings/verify-all'),
  setListingVerified: (id: string, verified: boolean) =>
    serverApi.patch(`/admin/listings/${id}/verified`, { verified }),
  setCommissionLock: (id: string, locked: boolean) =>
    serverApi.patch(`/admin/listings/${id}/commission-lock`, { locked }),
  listingLeads: (id: string) => serverApi.get<ListingLeadsPageData>(`/admin/listings/${id}/leads`),

  leads: () => serverApi.get<AdminLeadsPageData>('/admin/leads'),
  commissions: () => serverApi.get<AdminCommissionsPageData>('/admin/commissions'),
  createCommission: (data: { agent_id: string; listing_id: string; amount: number }) =>
    serverApi.post('/admin/commissions', data),
  payCommission: (id: string) => serverApi.patch(`/leads/commissions/${id}/pay`),
  transfers: () => serverApi.get<TransferRowData[]>('/admin/transfers'),
  analytics: () => serverApi.get<AdminAnalyticsData>('/admin/analytics'),

  // Official records (admin writes)
  createOfficialHostel: (data: Record<string, unknown>) => serverApi.post('/official-hostels', data),
  updateOfficialHostel: (id: string, data: Record<string, unknown>) =>
    serverApi.patch(`/official-hostels/${id}`, data),
  deleteOfficialHostel: (id: string) => serverApi.delete(`/official-hostels/${id}`),
  seedOfficialHostels: () => serverApi.post<{ seeded: number }>('/official-hostels/seed'),
};
