import { cache } from 'react';
import { unstable_cache } from 'next/cache';
import { supabasePublic } from '@/lib/supabase/public';
import { supabaseAdmin } from '@/lib/supabase/admin';
import type { Campus } from '@/types';
import { DEKUT_CAMPUS_FALLBACK } from '@/lib/data/campus-fallback';

export { DEKUT_CAMPUS_FALLBACK };

// The fallback id is the string sentinel 'dekut' (not a real UUID). A campus
// resolved from the DB always carries a UUID, so this distinguishes a live row
// from the fallback and lets callers skip campus-scoped queries until the
// campuses migration has actually been applied.
export function isFallbackCampus(campus: Campus): boolean {
  return campus.id === DEKUT_CAMPUS_FALLBACK.id;
}

const CAMPUS_CACHE_REVALIDATE = 3600;

async function fetchCampusBySlug(slug: string): Promise<Campus> {
  const { data } = await supabasePublic
    .from('campuses')
    .select('*')
    .eq('slug', slug)
    .eq('status', 'active')
    .single();

  if (!data) {
    return DEKUT_CAMPUS_FALLBACK;
  }

  return data as Campus;
}

export const getCampusBySlug = cache(
  unstable_cache(fetchCampusBySlug, ['campus-by-slug'], {
    revalidate: CAMPUS_CACHE_REVALIDATE,
  }),
);

async function fetchCampusById(id: string): Promise<Campus> {
  const { data } = await supabasePublic
    .from('campuses')
    .select('*')
    .eq('id', id)
    .eq('status', 'active')
    .single();

  if (!data) {
    return DEKUT_CAMPUS_FALLBACK;
  }

  return data as Campus;
}

export const getCampusById = cache(
  unstable_cache(
    async (id: string | null | undefined): Promise<Campus> => {
      if (!id) {
        return DEKUT_CAMPUS_FALLBACK;
      }
      return fetchCampusById(id);
    },
    ['campus-by-id'],
    { revalidate: CAMPUS_CACHE_REVALIDATE },
  ),
);

async function fetchAllCampuses(): Promise<Campus[]> {
  const { data } = await supabasePublic
    .from('campuses')
    .select('*')
    .neq('status', 'suspended')
    .order('slug', { ascending: true });

  if (!data || data.length === 0) {
    return [DEKUT_CAMPUS_FALLBACK];
  }

  return data as Campus[];
}

export const getAllCampuses = cache(
  unstable_cache(fetchAllCampuses, ['all-campuses'], {
    revalidate: CAMPUS_CACHE_REVALIDATE,
  }),
);

// Cookie-free variant for use in generateStaticParams (runs at build time without
// an HTTP request context). Uses the service-role admin client so no cookies() call
// is made, which would throw "cookies() was called in a static context".
export async function getAllCampusesStatic(): Promise<Campus[]> {
  const { data } = await supabaseAdmin
    .from('campuses')
    .select('*')
    .neq('status', 'suspended')
    .order('slug', { ascending: true });

  if (!data || data.length === 0) {
    return [DEKUT_CAMPUS_FALLBACK];
  }

  return data as Campus[];
}
