/** Server-only half of `profiles.ts` (uses the session cookie via next/headers). Never import from client components. */
import { serverApi } from './server';
import { fetchPublicApi } from './config';
import type { UserProfile, ProfileUpdate, LoginSyncResult } from './profiles';

export const profilesServerApi = {

  getMeServer: () => {
    return serverApi.get<UserProfile>('/profiles/me');
  },

  updateMeServer: (data: ProfileUpdate) => {
    return serverApi.patch<UserProfile>('/profiles/me', data);
  },

  setHomeCampusServer: (campusId: string, campusName: string) => {
    return serverApi.post<UserProfile>('/profiles/me/campus', { campus_id: campusId, campus_name: campusName });
  }
};
