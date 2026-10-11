'use client';

import * as React from 'react';
import { profilesApi, type UserProfile } from '@/lib/api/profiles';
import { createClient, hasStoredSession } from '@/lib/supabase/client';

export interface ShellUser {
  id: string;
  email: string | null;
  fullName: string | null;
  avatarUrl: string | null;
  isAdmin: boolean;
  isManager: boolean;
  hasAgent: boolean;
}

type AuthState =
  | { status: 'loading' }
  | { status: 'signed-out' }
  | { status: 'signed-in'; user: ShellUser };

interface ShellContextValue {
  auth: AuthState;
  collapsed: boolean;
  setCollapsed: (value: boolean) => void;
}

const ShellContext = React.createContext<ShellContextValue | null>(null);

const COLLAPSE_KEY = 'rumia:shell:collapsed';

function toShellUser(p: UserProfile): ShellUser {
  const isAdmin = p.role === 'admin';
  return {
    id: p.id,
    email: p.email ?? null,
    fullName: p.full_name ?? null,
    avatarUrl: p.avatar_url ?? null,
    isAdmin,
    isManager: p.role === 'manager' || isAdmin,
    hasAgent: !!p.agent_id,
  };
}

export function ShellProvider({ children }: { children: React.ReactNode }) {
  const [auth, setAuth] = React.useState<AuthState>({ status: 'loading' });
  const [collapsed, setCollapsedState] = React.useState(false);

  React.useEffect(() => {
    try {
      // Read after mount so server and first client render match.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setCollapsedState(localStorage.getItem(COLLAPSE_KEY) === '1');
    } catch {
      /* storage unavailable: default to expanded */
    }
  }, []);

  const setCollapsed = React.useCallback((value: boolean) => {
    setCollapsedState(value);
    try {
      localStorage.setItem(COLLAPSE_KEY, value ? '1' : '0');
    } catch {
      /* ignore */
    }
  }, []);

  React.useEffect(() => {
    let active = true;
    const load = async () => {
      // Cheap cookie check first so signed-out visitors cost no request.
      if (!hasStoredSession()) {
        if (active) setAuth({ status: 'signed-out' });
        return;
      }
      try {
        const profile = await profilesApi.getMe();
        if (active) setAuth({ status: 'signed-in', user: toShellUser(profile) });
      } catch (err) {
        const status = (err as { status?: number })?.status;
        if (!active) return;
        if (status === 401 || status === 403) {
          setAuth({ status: 'signed-out' });
        } else {
          // Transient failure while a session cookie exists: keep Account and Sign out reachable,
          // but grant no role-specific entries.
          setAuth({
            status: 'signed-in',
            user: { id: '', email: null, fullName: null, avatarUrl: null, isAdmin: false, isManager: false, hasAgent: false },
          });
        }
      }
    };
    void load();
    const { data } = createClient().auth.onAuthStateChange((event) => {
      if (event === 'SIGNED_OUT') setAuth({ status: 'signed-out' });
      if (event === 'SIGNED_IN') void load();
    });
    return () => {
      active = false;
      data.subscription.unsubscribe();
    };
  }, []);

  const value = React.useMemo(
    () => ({ auth, collapsed, setCollapsed }),
    [auth, collapsed, setCollapsed],
  );
  return <ShellContext.Provider value={value}>{children}</ShellContext.Provider>;
}

export function useShell(): ShellContextValue {
  const ctx = React.useContext(ShellContext);
  if (!ctx) throw new Error('useShell must be used inside <ShellProvider>');
  return ctx;
}
