import { cache } from 'react';
import { unstable_cache } from 'next/cache';
import type { Campus } from '@/types';
import { DEKUT_CAMPUS_FALLBACK } from '@/lib/data/campus-fallback';
import { getApiUrl } from '@/lib/api/config';

export { DEKUT_CAMPUS_FALLBACK };

export function isFallbackCampus(campus: Campus): boolean {
  return campus.id === DEKUT_CAMPUS_FALLBACK.id;
}

const CAMPUS_CACHE_REVALIDATE = 300;

async function publicFetch<T>(path: string): Promise<T | null> {
  const res = await fetch(getApiUrl(path), { cache: 'no-store' });
  if (!res.ok) {
    throw new Error(`API request failed: ${res.status} ${res.statusText}`);
  }
  return res.json() as T;
}

async function fetchCampusBySlug(slug: string): Promise<Campus> {
  try {
    const campus = await publicFetch<Campus>(`/campuses/${slug}`);
    return campus || DEKUT_CAMPUS_FALLBACK;
  } catch (error) {
    console.error(`Failed to fetch campus by slug (${slug}):`, error);
    return DEKUT_CAMPUS_FALLBACK;
  }
}

export const getCampusBySlug = cache(
  unstable_cache(fetchCampusBySlug, ['campuses'], {
    revalidate: CAMPUS_CACHE_REVALIDATE,
    tags: ['campuses'],
  }),
);

async function fetchCampusById(id: string): Promise<Campus> {
  // We don't have a direct getById in the new API, but we can list all and find it,
  // or use the backend (which normally searches by id or slug).
  // Actually, getBySlugServer on FastAPI backend supports either ID or Slug if implemented right.
  // Wait, the campus router only says /{slug}. Let's just fetch all and find it, it's cached anyway.
  try {
    const campuses = await publicFetch<Campus[]>('/campuses');
    const campus = campuses?.find((c) => c.id === id);
    return campus || DEKUT_CAMPUS_FALLBACK;
  } catch (error) {
    console.error(`Failed to fetch campus by id (${id}):`, error);
    return DEKUT_CAMPUS_FALLBACK;
  }
}

export const getCampusById = cache(
  unstable_cache(
    async (id: string | null | undefined): Promise<Campus> => {
      if (!id) {
        return DEKUT_CAMPUS_FALLBACK;
      }
      return fetchCampusById(id);
    },
    ['campuses'],
    { revalidate: CAMPUS_CACHE_REVALIDATE, tags: ['campuses'] },
  ),
);

async function fetchAllCampuses(): Promise<Campus[]> {
  try {
    const campuses = await publicFetch<Campus[]>('/campuses');
    if (!campuses || campuses.length === 0) {
      return [DEKUT_CAMPUS_FALLBACK];
    }
    return campuses;
  } catch (error) {
    console.error('Failed to fetch all campuses:', error);
    return [DEKUT_CAMPUS_FALLBACK];
  }
}

export const getAllCampuses = cache(
  unstable_cache(fetchAllCampuses, ['campuses'], {
    revalidate: CAMPUS_CACHE_REVALIDATE,
    tags: ['campuses'],
  }),
);

export async function getAllCampusesStatic(): Promise<Campus[]> {
  try {
    // Static fetch uses the cookie-free public API (campuses is public, no auth needed).
    const campuses = await publicFetch<Campus[]>('/campuses');
    if (!campuses || campuses.length === 0) {
      return [DEKUT_CAMPUS_FALLBACK];
    }
    return campuses;
  } catch (error) {
    return [DEKUT_CAMPUS_FALLBACK];
  }
}

