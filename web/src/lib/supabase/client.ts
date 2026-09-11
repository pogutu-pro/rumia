import { createBrowserClient } from '@supabase/ssr';

export function createClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

  // Safe fallback for pre-rendering / build-time environment
  if (!url || !key) {
    return {
      auth: {
        signInWithPassword: async () => ({
          data: { user: null },
          error: new Error('Supabase client unconfigured'),
        }),
        signOut: async () => ({ error: null }),
        onAuthStateChange: () => ({
          data: { subscription: { unsubscribe: () => {} } },
        }),
        getSession: async () => ({ data: { session: null }, error: null }),
        getUser: async () => ({ data: { user: null }, error: null }),
      },
      from: () => ({
        select: () => ({
          eq: () => ({
            single: async () => ({ data: null, error: null }),
            order: () => ({
              eq: () => ({
                single: async () => ({ data: null, error: null }),
              }),
            }),
          }),
        }),
      }),
    } as any;
  }

  return createBrowserClient(url, key, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: false,
    },
    cookieOptions: {
      sameSite: 'lax',
      path: '/',
    },
  });
}
