import { api } from './client';
import { serverApi } from './server';

export interface AgentProfileData {
  id: string;
  name: string;
  phone: string;
  whatsapp: string;
  status: string;
  campus_id?: string | null;
  portfolio_url?: string | null;
  is_featured: boolean;
  is_founder: boolean;
  bio?: string | null;
  profile_image_url?: string | null;
  created_at: string;
}

export interface AgentApplicationData {
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
  reviewed_at?: string | null;
  rejection_reason?: string | null;
  created_at: string;
}

export interface AgentApplicationCreate {
  campus_id: string;
  full_name: string;
  phone: string;
  id_number: string;
  hostel_name: string;
  relationship_to_hostel: string;
  owner_contact?: string | null;
}

export const agentsApi = {
  list: (campusId?: string) => {
    const params = campusId ? `?campus_id=${campusId}` : '';
    return api.get<AgentProfileData[]>(`/agents${params}`);
  },

  listServer: (campusId?: string) => {
    const params = campusId ? `?campus_id=${campusId}` : '';
    return serverApi.get<AgentProfileData[]>(`/agents${params}`);
  },

  getById: (agentId: string) => {
    return api.get<AgentProfileData>(`/agents/${agentId}`);
  },

  getByIdServer: (agentId: string) => {
    return serverApi.get<AgentProfileData>(`/agents/${agentId}`);
  },

  updateServer: (agentId: string, data: Partial<AgentProfileData>) => {
    return serverApi.patch<AgentProfileData>(`/agents/${agentId}`, data);
  },

  applyServer: (data: AgentApplicationCreate) => {
    return serverApi.post<AgentApplicationData>('/agents/apply', data);
  },

  getMyApplicationServer: () => {
    return serverApi.get<AgentApplicationData | null>('/agents/applications/my');
  },

  listApplicationsServer: () => {
    return serverApi.get<AgentApplicationData[]>('/agents/applications');
  },

  reviewApplicationServer: (applicationId: string, status: string, rejection_reason?: string) => {
    return serverApi.patch<AgentApplicationData>(`/agents/applications/${applicationId}/review`, {
      status,
      rejection_reason,
    });
  },
};
