import { cookies } from 'next/headers';
import { AT_COOKIE, isFresh, sessionFromToken } from '@/lib/auth/session';

/**
 * Server-side auth reader (Server Components / Actions / Route Handlers). It only *reads* the
 * session cookie, which `proxy.ts` keeps fresh. The claims are not verified here: they drive UX
 * (redirects, greetings) only, and every data call re-checks the token in the API.
 */
export async function createClient() {
  const store = await cookies();
  const session = () => {
    const s = sessionFromToken(store.get(AT_COOKIE)?.value);
    return isFresh(s, 0) ? s : null;
  };
  return {
    auth: {
      getSession: async () => ({ data: { session: session() }, error: null as Error | null }),
      getUser: async () => ({ data: { user: session()?.user ?? null }, error: null as Error | null }),
    },
  };
}
