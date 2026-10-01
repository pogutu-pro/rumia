import * as Linking from 'expo-linking';
import * as WebBrowser from 'expo-web-browser';

import { API_BASE_URL } from '../api/base-url';
import { secureStorage } from '../storage/secure-store';

WebBrowser.maybeCompleteAuthSession();

/** Public web origin that hosts the Google redirect (must match the registered redirect URI). */
const SITE_URL = (process.env.EXPO_PUBLIC_SITE_URL || 'https://rumia.co.ke').replace(/\/$/, '');
const APP_REDIRECT = 'rumia://auth/callback';
const STORAGE_KEY = 'rumia_session';
const REFRESH_SKEW_SECONDS = 60;

export interface AuthUser {
  id: string;
  email?: string;
  user_metadata?: { role?: string; full_name?: string; avatar_url?: string };
}

export interface AuthSession {
  access_token: string;
  refresh_token: string;
  expires_at: number; // epoch seconds
  user: AuthUser;
}

type AuthEvent = 'INITIAL_SESSION' | 'SIGNED_IN' | 'SIGNED_OUT' | 'TOKEN_REFRESHED';
type Listener = (event: AuthEvent, session: AuthSession | null) => void;

export class AuthFlowCancelledError extends Error {
  constructor() {
    super('Sign in was cancelled.');
    this.name = 'AuthFlowCancelledError';
  }
}

interface TokenResponse {
  access_token: string;
  refresh_token: string;
  expires_in: number;
  user_id: string;
}

const listeners = new Set<Listener>();
let cached: AuthSession | null | undefined;
let inflight: Promise<AuthSession | null> | null = null;

function emit(event: AuthEvent, session: AuthSession | null) {
  listeners.forEach((l) => {
    try {
      l(event, session);
    } catch {}
  });
}

async function load(): Promise<AuthSession | null> {
  if (cached !== undefined) return cached;
  try {
    const raw = await secureStorage.getItem(STORAGE_KEY);
    cached = raw ? (JSON.parse(raw) as AuthSession) : null;
  } catch {
    cached = null;
  }
  return cached;
}

async function save(session: AuthSession | null) {
  cached = session;
  if (session) await secureStorage.setItem(STORAGE_KEY, JSON.stringify(session));
  else await secureStorage.removeItem(STORAGE_KEY);
}

function toSession(t: TokenResponse): AuthSession {
  return {
    access_token: t.access_token,
    refresh_token: t.refresh_token,
    expires_at: Math.floor(Date.now() / 1000) + t.expires_in,
    user: { id: t.user_id },
  };
}

async function postToken(body: Record<string, string>): Promise<{ status: number; data: TokenResponse | null }> {
  const res = await fetch(`${API_BASE_URL}/auth/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  return { status: res.status, data: res.ok ? ((await res.json()) as TokenResponse) : null };
}

async function refresh(): Promise<AuthSession | null> {
  // Single-flight: refresh tokens rotate, so concurrent callers must share one exchange.
  inflight ??= (async () => {
    try {
      const current = await load();
      if (!current) return null;
      const { status, data } = await postToken({ grant_type: 'refresh_token', refresh_token: current.refresh_token });
      if (!data) {
        // Only a definitive rejection ends the session; network errors keep it for a retry.
        if (status === 401 || status === 400) {
          await save(null);
          emit('SIGNED_OUT', null);
          return null;
        }
        return current;
      }
      const next = { ...toSession(data), user: current.user };
      await save(next);
      emit('TOKEN_REFRESHED', next);
      return next;
    } catch {
      return (await load()) ?? null; // offline: keep the stored session
    } finally {
      inflight = null;
    }
  })();
  return inflight;
}

export const authClient = {
  getSession: async (): Promise<{ data: { session: AuthSession | null }; error: null }> => {
    const session = await load();
    if (session && session.expires_at - Math.floor(Date.now() / 1000) <= REFRESH_SKEW_SECONDS) {
      return { data: { session: await refresh() }, error: null };
    }
    return { data: { session }, error: null };
  },

  refreshSession: async (): Promise<{ data: { session: AuthSession | null }; error: null }> => ({
    data: { session: await refresh() },
    error: null,
  }),

  signOut: async () => {
    const current = await load();
    await save(null);
    emit('SIGNED_OUT', null);
    if (current) {
      fetch(`${API_BASE_URL}/auth/logout`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refresh_token: current.refresh_token }),
      }).catch(() => {});
    }
    return { error: null };
  },

  onAuthStateChange: (cb: Listener) => {
    listeners.add(cb);
    void load().then((s) => cb('INITIAL_SESSION', s));
    return { data: { subscription: { unsubscribe: () => listeners.delete(cb) } } };
  },
};

/**
 * Google sign-in: the system browser runs the flow on the web origin (the registered redirect
 * URI), which hands back a one-time code on our deep link; the app redeems it for a session.
 */
export async function signInWithGoogle(): Promise<AuthSession> {
  const startUrl = `${SITE_URL}/auth/google/start?app_redirect=${encodeURIComponent(APP_REDIRECT)}`;
  const result = await WebBrowser.openAuthSessionAsync(startUrl, APP_REDIRECT);
  if (result.type !== 'success') throw new AuthFlowCancelledError();

  const params = Linking.parse(result.url).queryParams ?? {};
  const code = typeof params.code === 'string' ? params.code : null;
  if (!code) {
    const err = typeof params.error === 'string' ? params.error : null;
    throw new Error(err ? `Google sign in failed (${err}).` : 'Google sign in returned without a code.');
  }

  const { data } = await postToken({ grant_type: 'otc', code });
  if (!data) throw new Error('Google sign in could not be completed. Please try again.');
  const session = toSession(data);
  await save(session);
  emit('SIGNED_IN', session);
  return session;
}
