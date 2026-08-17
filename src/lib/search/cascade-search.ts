import { createClient } from '@/lib/supabase/client';
import { parseQuery } from './parse-query';
import { fuzzySearch, type FuzzyListing } from './fuzzy-search';

// ── Types ─────────────────────────────────────────────────────────────────────

export interface SearchListing {
  id: string;
  title: string;
  description: string;
  price: number;
  location: string;
  slug: string | null;
  county: string | null;
  area: string | null;
  gender?: 'mixed' | 'male' | 'female' | null;
  specific_location?: string | null;
  price_single?: number | null;
  price_sharing?: number | null;
  distance_category?: string | null;
  distance_to_campus?: string | null;
  mpesa_details?: string | null;
  amenities?: string[] | null;
  room_type?: string | null;
  room_type_enum?: string | null;
  bathroom_type?: string | null;
  wifi_included?: boolean | null;
  water_included?: boolean | null;
  electricity_included?: boolean | null;
  hot_water_included?: boolean | null;
  cooking_gas_included?: boolean | null;
  security_type?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  proximity_description?: string | null;
  created_at?: string;
  sort_position?: number | null;
  listing_images: {
    r2_url: string;
    display_order: number;
    blur_data_url?: string;
  }[];
  agents: { name: string; phone?: string; whatsapp?: string } | null;
  listing_room_types?: {
    deposit?: number | null;
    furnishing_items?: string[] | null;
    room_type?: string | null;
  }[] | null;
}

export interface CombinedFilters {
  searchText: string;
  genders: string[];
  amenities: string[];
  roomTypes: string[];
  minPrice: number | null;
  maxPrice: number | null;
  zones: string[];
}

export type CascadeTier = 1 | 1.1 | 1.2 | 2 | 3;

export interface CascadeResult {
  listings: SearchListing[];
  count: number;
  tier: CascadeTier;
  effectiveFilters: CombinedFilters;
  originalFreeText: string;
}

interface ScoredResult {
  listing: SearchListing;
  score: number;
}

// ── Constants ─────────────────────────────────────────────────────────────────

const LISTING_SELECT = `id, title, description, price, location, slug, county, area, gender, specific_location,
  price_single, price_sharing, distance_category, distance_to_campus, mpesa_details,
  amenities, room_type, room_type_enum, bathroom_type,
  wifi_included, water_included, electricity_included, hot_water_included, cooking_gas_included, security_type,
  latitude, longitude, proximity_description, created_at, sort_position,
  listing_images(r2_url, display_order, blur_data_url),
   listing_room_types(deposit, furnishing_items, room_type),
   agents(name, phone, whatsapp)`;

// ── Helpers ───────────────────────────────────────────────────────────────────

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function hasStructuredFilters(filters: CombinedFilters): boolean {
  return (
    filters.genders.length > 0 ||
    filters.amenities.length > 0 ||
    filters.roomTypes.length > 0 ||
    filters.minPrice !== null ||
    filters.maxPrice !== null ||
    filters.zones.length > 0
  );
}

function applyStructuredFilters(
  q: ReturnType<ReturnType<typeof createClient>['from']>,
  filters: CombinedFilters,
) {
  let query = q;
  if (filters.genders.length > 0) query = query.in('gender', filters.genders);
  if (filters.amenities.length > 0) {
    filters.amenities.forEach((a) => {
      if (a === 'Hot Water') {
        query = query.eq('hot_water_included', true);
      } else if (a === 'Cooking Gas') {
        query = query.eq('cooking_gas_included', true);
      } else if (a === 'Water') {
        query = query.eq('water_included', true);
      } else if (a === 'Electricity') {
        query = query.eq('electricity_included', true);
      } else if (a === 'WiFi') {
        query = query.eq('wifi_included', true);
      } else {
        query = query.contains('amenities', [a]);
      }
    });
  }
  if (filters.minPrice !== null) query = query.gte('price', filters.minPrice);
  if (filters.maxPrice !== null) query = query.lte('price', filters.maxPrice);
  if (filters.zones.length > 0) query = query.in('area', filters.zones);
  return query;
}

function applyParsedFilters(
  q: ReturnType<ReturnType<typeof createClient>['from']>,
  parsed: ReturnType<typeof parseQuery>,
) {
  let query = q;
  if (parsed.maxPrice) query = query.lte('price', parsed.maxPrice);
  if (parsed.minPrice) query = query.gte('price', parsed.minPrice);
  if (parsed.exactPrice) {
    query = query
      .gte('price', parsed.exactPrice - 500)
      .lte('price', parsed.exactPrice + 500);
  }
  if (parsed.gender) query = query.eq('gender', parsed.gender);
  parsed.amenities.forEach((a) => {
    if (a === 'Hot Water') {
      query = query.eq('hot_water_included', true);
    } else if (a === 'Cooking Gas') {
      query = query.eq('cooking_gas_included', true);
    } else if (a === 'Water') {
      query = query.eq('water_included', true);
    } else if (a === 'Electricity') {
      query = query.eq('electricity_included', true);
    } else if (a === 'WiFi') {
      query = query.eq('wifi_included', true);
    } else {
      query = query.contains('amenities', [a]);
    }
  });
  if (parsed.area) query = query.eq('area', parsed.area);
  if (parsed.proximityGate)
    query = query.ilike('proximity_description', `%Gate ${parsed.proximityGate}%`);
  return query;
}

function sortResults(listings: SearchListing[]): SearchListing[] {
  const sorted = [...listings];
  sorted.sort((a, b) => {
    const aPos = a.sort_position ?? null;
    const bPos = b.sort_position ?? null;
    if (aPos !== null && bPos !== null) return aPos - bPos;
    if (aPos !== null) return -1;
    if (bPos !== null) return 1;
    return 0;
  });
  return sorted;
}

// ── Relevance Scoring ─────────────────────────────────────────────────────────

function scoreResult(
  listing: SearchListing,
  freeText: string,
  matchType: 'exact' | 'word' | 'fuzzy',
): number {
  if (!freeText) return 0;
  const lower = freeText.toLowerCase();
  const words = lower.split(/\s+/).filter((w) => w.length >= 2);

  let bestFieldScore = 0;

  const titleLower = listing.title?.toLowerCase() ?? '';
  const locLower = listing.location?.toLowerCase() ?? '';
  const areaLower = listing.area?.toLowerCase() ?? '';
  const descLower = listing.description?.toLowerCase() ?? '';

  // Title
  if (titleLower.includes(lower)) {
    bestFieldScore = Math.max(bestFieldScore, 1.0);
  } else if (words.length > 0 && words.every((w) => titleLower.includes(w))) {
    bestFieldScore = Math.max(bestFieldScore, 0.95);
  } else if (words.some((w) => titleLower.includes(w))) {
    bestFieldScore = Math.max(bestFieldScore, 0.8);
  }

  // Location
  if (locLower.includes(lower)) {
    bestFieldScore = Math.max(bestFieldScore, 0.8);
  } else if (words.length > 0 && words.every((w) => locLower.includes(w))) {
    bestFieldScore = Math.max(bestFieldScore, 0.72);
  } else if (words.some((w) => locLower.includes(w))) {
    bestFieldScore = Math.max(bestFieldScore, 0.6);
  }

  // Area
  if (areaLower.includes(lower)) {
    bestFieldScore = Math.max(bestFieldScore, 0.7);
  } else if (words.some((w) => areaLower.includes(w))) {
    bestFieldScore = Math.max(bestFieldScore, 0.5);
  }

  // Description
  if (descLower.includes(lower)) {
    bestFieldScore = Math.max(bestFieldScore, 0.5);
  } else if (words.some((w) => descLower.includes(w))) {
    bestFieldScore = Math.max(bestFieldScore, 0.35);
  }

  const typeWeight = matchType === 'exact' ? 100 : matchType === 'word' ? 65 : 35;
  return typeWeight * bestFieldScore;
}

function mergeAndScore(
  batches: { listings: SearchListing[]; matchType: 'exact' | 'word' | 'fuzzy' }[],
  freeText: string,
): ScoredResult[] {
  const map = new Map<string, ScoredResult>();

  for (const batch of batches) {
    for (const listing of batch.listings) {
      const id = String(listing.id);
      const existing = map.get(id);
      const newScore = scoreResult(listing, freeText, batch.matchType);

      if (!existing || newScore > existing.score) {
        map.set(id, { listing, score: newScore });
      }
    }
  }

  return Array.from(map.values()).sort((a, b) => b.score - a.score);
}

// ── Strategy A: Exact phrase ilike ────────────────────────────────────────────

async function fetchExactPhrase(
  freeText: string,
  filters: CombinedFilters,
  parsed: ReturnType<typeof parseQuery>,
  from: number,
  to: number,
): Promise<{ listings: SearchListing[]; count: number }> {
  const supabase = createClient();
  let q = supabase
    .from('listings')
    .select(LISTING_SELECT, { count: 'exact' })
    .eq('is_active', true);

  q = applyParsedFilters(q, parsed);

  if (freeText) {
    q = q.or(
      [
        `title.ilike.%${freeText}%`,
        `description.ilike.%${freeText}%`,
        `location.ilike.%${freeText}%`,
        `area.ilike.%${freeText}%`,
        `agents.name.ilike.%${freeText}%`,
      ].join(','),
    );
  }

  q = applyStructuredFilters(q, filters);

  q = parsed.sortByProximity
    ? q.order('proximity_description', { ascending: true })
    : q.order('sort_position', { ascending: true, nullsFirst: false }).order('created_at', { ascending: false });

  q = q.range(from, to);

  const { data, count } = await q;
  return { listings: (data as SearchListing[]) || [], count: count || 0 };
}

// ── Strategy B: Word-level ilike ──────────────────────────────────────────────

async function fetchWordLevel(
  freeText: string,
  filters: CombinedFilters,
  parsed: ReturnType<typeof parseQuery>,
  from: number,
  to: number,
): Promise<{ listings: SearchListing[]; count: number }> {
  const words = freeText.split(/\s+/).filter((w) => w.length >= 2);
  if (words.length === 0) return { listings: [], count: 0 };

  const supabase = createClient();
  let q = supabase
    .from('listings')
    .select(LISTING_SELECT, { count: 'exact' })
    .eq('is_active', true);

  q = applyParsedFilters(q, parsed);

  const orConditions = words.flatMap((word) => [
    `title.ilike.%${word}%`,
    `location.ilike.%${word}%`,
    `area.ilike.%${word}%`,
    `description.ilike.%${word}%`,
  ]);
  q = q.or(orConditions.join(','));

  q = applyStructuredFilters(q, filters);

  q = parsed.sortByProximity
    ? q.order('proximity_description', { ascending: true })
    : q.order('sort_position', { ascending: true, nullsFirst: false }).order('created_at', { ascending: false });

  q = q.range(from, to);

  const { data, count } = await q;
  return { listings: (data as SearchListing[]) || [], count: count || 0 };
}

// ── Strategy C: Fuzzy match (client-side) ────────────────────────────────────

async function fetchFuzzy(
  freeText: string,
  limit: number,
): Promise<{ listings: FuzzyListing[]; count: number }> {
  const result = await fuzzySearch(freeText, limit);
  return { listings: result.listings, count: result.totalCount };
}

async function fetchFullListingsByIds(ids: string[]): Promise<SearchListing[]> {
  if (ids.length === 0) return [];
  const supabase = createClient();
  const { data } = await supabase
    .from('listings')
    .select(LISTING_SELECT)
    .eq('is_active', true)
    .in('id', ids);
  return (data as SearchListing[]) || [];
}

// ── Pagination helper ─────────────────────────────────────────────────────────

function paginate(scored: ScoredResult[], from: number, to: number): ScoredResult[] {
  return scored.slice(from, to + 1);
}

// ── Cascade Search (5 tiers, multi-strategy) ──────────────────────────────────

export async function cascadeSearch(
  filters: CombinedFilters,
  pageSize: number,
): Promise<CascadeResult> {
  const parsed = parseQuery(filters.searchText);
  const freeText = parsed.freeText;

  // ── Tier 1: Exact phrase + all filters ────────────────────────────────────
  const [exactResult, wordResult] = await Promise.all([
    fetchExactPhrase(freeText, filters, parsed, 0, pageSize * 2 - 1),
    freeText.split(/\s+/).filter((w) => w.length >= 2).length > 1
      ? fetchWordLevel(freeText, filters, parsed, 0, pageSize * 2 - 1)
      : Promise.resolve({ listings: [] as SearchListing[], count: 0 }),
  ]);

  if (exactResult.count > 0 || wordResult.count > 0) {
    const merged = mergeAndScore(
      [
        { listings: exactResult.listings, matchType: 'exact' },
        { listings: wordResult.listings, matchType: 'word' },
      ],
      freeText,
    );

    const paginated = paginate(merged, 0, pageSize - 1);
    const tier: CascadeTier = exactResult.count > 0 ? 1 : 1.1;

    return {
      listings: sortResults(paginated.map((r) => r.listing)),
      count: Math.max(exactResult.count, wordResult.count),
      tier,
      effectiveFilters: filters,
      originalFreeText: freeText,
    };
  }

  // ── Tier 1.2: Fuzzy match (client-side, no DB filters) ────────────────────
  if (freeText && freeText.length >= 2) {
    try {
      const fuzzyResult = await fetchFuzzy(freeText, pageSize * 2);
      if (fuzzyResult.count > 0) {
        const fuzzyIds = fuzzyResult.listings.map((fl) => fl.id);
        const fullListings = await fetchFullListingsByIds(fuzzyIds);

        const fuzzyScoreMap = new Map<string, number>();
        for (const fl of fuzzyResult.listings) {
          const match = fullListings.find((sl) => String(sl.id) === fl.id);
          if (match) {
            fuzzyScoreMap.set(fl.id, scoreResult(match, freeText, 'fuzzy'));
          }
        }

        const scored: ScoredResult[] = fullListings.map((sl) => ({
          listing: sl,
          score: fuzzyScoreMap.get(String(sl.id)) ?? 0,
        }));
        scored.sort((a, b) => b.score - a.score);
        const paginated = scored.slice(0, pageSize);

        return {
          listings: sortResults(paginated.map((r) => r.listing)),
          count: fuzzyResult.count,
          tier: 1.2,
          effectiveFilters: filters,
          originalFreeText: freeText,
        };
      }
    } catch {
      // Fuzzy search failed silently — continue to next tier
    }
  }

  // ── Tier 2: Structured filters only (drop free text) ──────────────────────
  if (freeText && hasStructuredFilters(filters)) {
    const tier2Filters: CombinedFilters = { ...filters, searchText: '' };
    const tier2Parsed = parseQuery('');
    const tier2Result = await fetchExactPhrase('', tier2Filters, tier2Parsed, 0, pageSize - 1);
    if (tier2Result.count > 0) {
      return {
        listings: sortResults(tier2Result.listings),
        count: tier2Result.count,
        tier: 2,
        effectiveFilters: tier2Filters,
        originalFreeText: freeText,
      };
    }
  }

  // ── Tier 3: All active hostels (last resort) ──────────────────────────────
  const tier3Filters: CombinedFilters = {
    searchText: '',
    genders: [],
    amenities: [],
    roomTypes: [],
    minPrice: null,
    maxPrice: null,
    zones: [],
  };
  const tier3Parsed = parseQuery('');
  const tier3Result = await fetchExactPhrase('', tier3Filters, tier3Parsed, 0, pageSize - 1);
  return {
    listings: sortResults(tier3Result.listings),
    count: tier3Result.count,
    tier: 3,
    effectiveFilters: tier3Filters,
    originalFreeText: freeText,
  };
}

// ── Paginated fetch (unchanged API for infinite scroll) ───────────────────────

export async function fetchListings(
  filters: CombinedFilters,
  from: number = 0,
  to: number = 23,
): Promise<{ listings: SearchListing[]; count: number }> {
  const supabase = createClient();
  let q = supabase
    .from('listings')
    .select(LISTING_SELECT, { count: 'exact' })
    .eq('is_active', true);

  const parsed = parseQuery(filters.searchText);

  q = applyParsedFilters(q, parsed);

  if (parsed.freeText) {
    q = q.or(
      [
        `title.ilike.%${parsed.freeText}%`,
        `description.ilike.%${parsed.freeText}%`,
        `location.ilike.%${parsed.freeText}%`,
        `area.ilike.%${parsed.freeText}%`,
        `agents.name.ilike.%${parsed.freeText}%`,
      ].join(','),
    );
  }

  q = applyStructuredFilters(q, filters);

  q = parsed.sortByProximity
    ? q.order('proximity_description', { ascending: true })
    : q.order('sort_position', { ascending: true, nullsFirst: false }).order('created_at', { ascending: false });

  q = q.range(from, to);

  const { data, count } = await q;
  const results = (data as SearchListing[]) || [];

  return { listings: results, count: count || 0 };
}
