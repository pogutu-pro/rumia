import Fuse, { type IFuseOptions } from 'fuse.js';
import { createClient } from '@/lib/supabase/client';

// ── Lightweight listing shape for fuzzy matching (no images/agents) ───────────

export interface FuzzyListing {
  id: string;
  title: string;
  description: string;
  price: number;
  location: string;
  area: string | null;
  slug: string | null;
  county: string | null;
  sort_position: number | null;
}

// ── Fuse.js configuration ─────────────────────────────────────────────────────

const FUSE_OPTIONS: IFuseOptions<FuzzyListing> = {
  keys: [
    { name: 'title', weight: 1.0 },
    { name: 'location', weight: 0.8 },
    { name: 'area', weight: 0.7 },
    { name: 'description', weight: 0.4 },
  ],
  threshold: 0.4,
  includeScore: true,
  minMatchCharLength: 2,
  ignoreLocation: true,
  findAllMatches: true,
};

// ── Cache ─────────────────────────────────────────────────────────────────────

const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

let cachedListings: FuzzyListing[] | null = null;
let cacheTimestamp = 0;
let inflightPromise: Promise<FuzzyListing[]> | null = null;

const LIGHT_SELECT = 'id, title, description, price, location, area, slug, county, sort_position';

async function loadAllListings(): Promise<FuzzyListing[]> {
  if (cachedListings && Date.now() - cacheTimestamp < CACHE_TTL_MS) {
    return cachedListings;
  }

  if (inflightPromise) return inflightPromise;

  inflightPromise = (async () => {
    const supabase = createClient();
    const { data } = await supabase
      .from('listings')
      .select(LIGHT_SELECT)
      .eq('is_active', true);

    const listings = (data as FuzzyListing[]) || [];
    cachedListings = listings;
    cacheTimestamp = Date.now();
    inflightPromise = null;
    return listings;
  })();

  return inflightPromise;
}

// ── Public API ────────────────────────────────────────────────────────────────

export interface FuzzyResult {
  listings: FuzzyListing[];
  totalCount: number;
}

export async function fuzzySearch(
  query: string,
  limit: number = 50,
): Promise<FuzzyResult> {
  if (!query || query.trim().length < 2) {
    return { listings: [], totalCount: 0 };
  }

  const allListings = await loadAllListings();
  if (allListings.length === 0) {
    return { listings: [], totalCount: 0 };
  }

  const fuse = new Fuse(allListings, FUSE_OPTIONS);
  const results = fuse.search(query, { limit });

  return {
    listings: results.map((r) => r.item),
    totalCount: results.length,
  };
}

export function invalidateFuzzyCache(): void {
  cachedListings = null;
  cacheTimestamp = 0;
}
