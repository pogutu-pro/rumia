import { api } from './client';
import { serverApi } from './server';
import { getApiUrl } from './config';

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
  home_campus_confirmed_at?: string | null;
  school_verified?: boolean;
  full_name?: string | null;
  phone?: string | null;
  avatar_url?: string | null;
  /** Present when the user owns an agent record. */
  agent_id?: string | null;
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

export interface LoginSyncResult {
  role: string;
  needs_profile_completion: boolean;
  linked_bookings: number;
}

export const profilesApi = {
  /**
   * Server-only, for the OAuth callback: the session cookie is not readable yet (it was just
   * set on the redirect response), so the fresh access token is passed explicitly.
   */
  syncLoginWithToken: async (
    accessToken: string,
    details: { full_name?: string | null; avatar_url?: string | null },
  ): Promise<LoginSyncResult> => {
    const response = await fetch(getApiUrl('/profiles/me/sync-login'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${accessToken}` },
      body: JSON.stringify(details),
      cache: 'no-store',
    });
    if (!response.ok) {
      throw new Error(`sync-login failed: ${response.status}`);
    }
    return response.json();
  },

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
