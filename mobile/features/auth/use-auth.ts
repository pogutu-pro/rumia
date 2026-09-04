import { useCallback } from 'react';
import { useRouter } from 'expo-router';
import type { Session, User } from '@supabase/supabase-js';
import { apiFetch } from '../../lib/api/client';
import type { Profile } from '../../lib/api/schema';
import { supabase } from '../../lib/supabase/client';
import { unregisterPushToken } from '../notifications/use-push-notifications';
import { useSessionStore, type UserProfileData } from '../../stores/session';

function sessionUser(authUser: User, profile?: Profile): UserProfileData {
  return {
    id: authUser.id,
    email: profile?.email ?? authUser.email,
    role: profile?.role ?? authUser.user_metadata?.role ?? 'student',
    full_name: profile?.full_name ?? undefined,
    phone: profile?.phone ?? undefined,
    avatar_url: profile?.avatar_url ?? undefined,
    home_campus_id: profile?.home_campus_id ?? undefined,
    home_campus_name: profile?.home_campus_name ?? undefined,
    home_campus_confirmed: profile?.home_campus_confirmed,
  };
}

export async function hydrateSessionUser(authUser: User) {
  try {
    const profile = await apiFetch<Profile>('/profiles/me');
    return sessionUser(authUser, profile);
  } catch {
    return sessionUser(authUser);
  }
}

export function useSessionHydration() {
  const setUser = useSessionStore((state) => state.setUser);
  const clearSession = useSessionStore((state) => state.clearSession);

  return useCallback(
    async (session: Session | null) => {
      if (!session?.user) {
        clearSession();
        return;
      }

      setUser(await hydrateSessionUser(session.user));
    },
    [clearSession, setUser],
  );
}

export function useAuthActions() {
  const router = useRouter();
  const clearSession = useSessionStore((state) => state.clearSession);

  const signOut = useCallback(async () => {
    await unregisterPushToken();
    await supabase.auth.signOut();
    clearSession();
    router.replace('/(tabs)');
  }, [clearSession, router]);

  return { signOut };
}
