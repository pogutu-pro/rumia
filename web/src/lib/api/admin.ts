import { api } from './client';
import { serverApi } from './server';

export interface CampusAdminData {
  id: string;
  slug: string;
  name: string;
  city: string;
  hero_headline?: string | null;
  hero_subtext?: string | null;
  whatsapp_number?: string | null;
  primary_color?: string | null;
  status: string;
}

export interface ManagerAdminData {
  id: string;
  email: string;
  role: string;
  managed_campus_id?: string | null;
  managed_region_id?: string | null;
}

export interface PlatformStats {
  total_listings: number;
  active_listings: number;
  total_agents: number;
  total_students: number;
}

export const adminApi = {
  getCampusesServer: () => {
    return serverApi.get<CampusAdminData[]>('/admin/campuses');
  },

  createCampusServer: (data: any) => {
    return serverApi.post<CampusAdminData>('/admin/campuses', data);
  },

  updateCampusServer: (campusId: string, data: any) => {
    return serverApi.patch<CampusAdminData>(`/admin/campuses/${campusId}`, data);
  },

  updateCampusStatusServer: (campusId: string, status: string) => {
    return serverApi.patch<CampusAdminData>(`/admin/campuses/${campusId}/status`, { status });
  },

  getManagersServer: () => {
    return serverApi.get<ManagerAdminData[]>('/admin/managers');
  },

  assignManagerServer: (userId: string, managedCampusId?: string, managedRegionId?: string) => {
    return serverApi.post<ManagerAdminData>('/admin/managers', {
      user_id: userId,
      managed_campus_id: managedCampusId,
      managed_region_id: managedRegionId,
    });
  },

  removeManagerServer: (userId: string) => {
    return serverApi.delete(`/admin/managers/${userId}`);
  },

  getAgentsServer: () => {
    return serverApi.get<{ items: any[]; total: number }>('/admin/agents');
  },

  updateAgentStatusServer: (agentId: string, status: string) => {
    return serverApi.patch(`/admin/agents/${agentId}/status`, { status });
  },

  transferListingServer: (listingId: string, newAgentId: string) => {
    return serverApi.post('/admin/agents/transfer', {
      listing_id: listingId,
      new_agent_id: newAgentId,
    });
  },

  getStatsServer: () => {
    return serverApi.get<PlatformStats>('/admin/stats');
  },
};
