import { create } from 'zustand';

export interface UserProfileData {
  id: string;
  email?: string;
  role: string;
  full_name?: string;
  phone?: string;
  avatar_url?: string;
  home_campus_id?: string;
  home_campus_name?: string;
  home_campus_confirmed?: boolean;
}

interface SessionState {
  user: UserProfileData | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  setUser: (user: UserProfileData | null) => void;
  clearSession: () => void;
}

export const useSessionStore = create<SessionState>((set) => ({
  user: null,
  isAuthenticated: false,
  isLoading: true,
  setUser: (user) => set({ user, isAuthenticated: !!user, isLoading: false }),
  clearSession: () => set({ user: null, isAuthenticated: false, isLoading: false }),
}));
