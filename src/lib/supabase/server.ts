import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';

export async function createClient() {
  const cookieStore = await cookies();

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

  if (!url || !key) {
    return {
      auth: {
        getUser: async () => ({ data: { user: null }, error: null }),
        getSession: async () => ({ data: { session: null }, error: null }),
      },
      from: () => {
        const dummyQuery = {
          eq: () => dummyQuery,
          order: () => dummyQuery,
          limit: () => dummyQuery,
          single: async () => ({ data: null, error: null }),
          then: (resolve: any) => resolve({ data: null, error: null }),
        };
        return { select: () => dummyQuery };
      },
    } as any;
  }

  return createServerClient(
    url,
    key,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          } catch {
            // This can be ignored if called from a Server Component
          }
        },
      },
    }
  );
}
