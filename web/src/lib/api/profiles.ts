import { api } from './client';
import { serverApi } from './server';

export interface UserProfile {
  id: string;
  email?: string | null;
  role: string;
  campus_id?: string | null;
  home_campus_id?: string | null;
  managed_campus_id?: string | null;
  managed_region_id?: string | null;
  home_campus_name?: string | null;
  home_campus_confirmed: boolean;
  created_at: string;
}

export interface ProfileUpdate {
  full_name?: string | null;
  phone?: string | null;
  home_campus_id?: string | null;
  home_campus_name?: string | null;
  home_campus_confirmed?: boolean;
  campus_input?: string;
}

export const profilesApi = {
  getMe: () => {
    return api.get<UserProfile>('/profiles/me');
  },

  getMeServer: () => {
    return serverApi.get<UserProfile>('/profiles/me');
  },

  updateMe: (data: ProfileUpdate) => {
    return api.patch<UserProfile>('/profiles/me', data);
  },

  updateMeServer: (data: ProfileUpdate) => {
    return serverApi.patch<UserProfile>('/profiles/me', data);
  },

  setHomeCampus: (campusId: string, campusName: string) => {
    return api.post<UserProfile>('/profiles/me/campus', { campus_id: campusId, campus_name: campusName });
  },

  setHomeCampusServer: (campusId: string, campusName: string) => {
    return serverApi.post<UserProfile>('/profiles/me/campus', { campus_id: campusId, campus_name: campusName });
  },
};
