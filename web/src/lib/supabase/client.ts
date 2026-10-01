import {
  AT_COOKIE,
  HINT_COOKIE,
  isFresh,
  sessionFromToken,
  type AuthSession,
} from '@/lib/auth/session';

/**
 * Browser auth client. Keeps the small surface the app was written against
 * (`createClient().auth.getUser/getSession/signOut/signInWithOAuth/onAuthStateChange`) but is
 * backed by our own cookies + FastAPI /auth endpoints. There is no database access here.
 */
type AuthEvent = 'INITIAL_SESSION' | 'SIGNED_IN' | 'SIGNED_OUT' | 'TOKEN_REFRESHED';
type Listener = (event: AuthEvent, session: AuthSession | null) => void;

const listeners = new Set<Listener>();
let inflight: Promise<AuthSession | null> | null = null;

function readCookie(name: string): string | undefined {
  if (typeof document === 'undefined') return undefined;
  for (const part of document.cookie.split(';')) {
    const eq = part.indexOf('=');
    if (part.slice(0, eq).trim() === name) return decodeURIComponent(part.slice(eq + 1));
  }
  return undefined;
}

function emit(event: AuthEvent, session: AuthSession | null) {
  listeners.forEach((l) => {
    try {
      l(event, session);
    } catch {}
  });
}

async function refresh(): Promise<AuthSession | null> {
  // Single-flight so concurrent callers share one refresh.
  inflight ??= (async () => {
    try {
      const res = await fetch('/auth/refresh', { method: 'POST', credentials: 'same-origin' });
      if (!res.ok) {
        if (res.status === 401) emit('SIGNED_OUT', null);
        return null;
      }
      const { access_token } = await res.json();
      const session = sessionFromToken(access_token);
      if (session) emit('TOKEN_REFRESHED', session);
      return session;
    } catch {
      return null;
    } finally {
      inflight = null;
    }
  })();
  return inflight;
}

export async function getBrowserSession(): Promise<AuthSession | null> {
  if (typeof document === 'undefined') return null;
  const current = sessionFromToken(readCookie(AT_COOKIE));
  if (isFresh(current)) return current;
  if (!readCookie(HINT_COOKIE)) return null; // never signed in on this browser: no network call
  return refresh();
}

export function hasStoredSession(): boolean {
  return !!readCookie(HINT_COOKIE);
}

export function createClient() {
  return {
    auth: {
      getSession: async () => ({ data: { session: await getBrowserSession() }, error: null as Error | null }),
      getUser: async () => {
        const session = await getBrowserSession();
        return { data: { user: session?.user ?? null }, error: null as Error | null };
      },
      signInWithOAuth: async (opts: { options?: { redirectTo?: string } } = {}) => {
        const next = opts.options?.redirectTo ? new URL(opts.options.redirectTo, window.location.origin).searchParams.get('next') : null;
        const url = `/auth/google/start${next ? `?next=${encodeURIComponent(next)}` : ''}`;
        window.location.assign(url);
        return { data: { url }, error: null as Error | null };
      },
      signOut: async (_opts?: unknown) => {
        try {
          await fetch('/auth/logout', { method: 'POST', credentials: 'same-origin' });
        } catch {}
        emit('SIGNED_OUT', null);
        return { error: null as Error | null };
      },
      onAuthStateChange: (cb: Listener) => {
        listeners.add(cb);
        getBrowserSession().then((s) => cb('INITIAL_SESSION', s));
        return { data: { subscription: { unsubscribe: () => listeners.delete(cb) } } };
      },
    },
  };
}
