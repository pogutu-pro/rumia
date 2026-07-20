import { createClient } from '@/lib/supabase/client';
import { parseQuery } from './parse-query';

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

export interface CascadeResult {
  listings: SearchListing[];
  count: number;
  tier: 1 | 2 | 3;
  effectiveFilters: CombinedFilters;
  originalFreeText: string;
}

// ── Single Query Builder ──────────────────────────────────────────────────────
// One Supabase query with LEFT JOINs — no N+1.

const LISTING_SELECT = `id, title, description, price, location, slug, county, area, gender, specific_location,
  price_single, price_sharing, distance_category, distance_to_campus, mpesa_details,
  amenities, room_type, room_type_enum, bathroom_type,
  wifi_included, water_included, electricity_included, security_type,
  latitude, longitude, proximity_description, created_at, sort_position,
  listing_images(r2_url, display_order, blur_data_url),
   listing_room_types(deposit, furnishing_items, room_type),
   agents(name, phone, whatsapp)`;

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

  // ── Apply parsed filters ──────────────────────────────────────────────────
  if (parsed.maxPrice) q = q.lte('price', parsed.maxPrice);
  if (parsed.exactPrice) {
    q = q
      .gte('price', parsed.exactPrice - 500)
      .lte('price', parsed.exactPrice + 500);
  }
  if (parsed.gender) q = q.eq('gender', parsed.gender);
  if (parsed.roomType) q = q.eq('room_type_enum', parsed.roomType);
  parsed.amenities.forEach((a) => {
    q = q.contains('amenities', [a]);
  });
  if (parsed.area) q = q.eq('area', parsed.area);
  if (parsed.proximityGate)
    q = q.ilike('proximity_description', `%Gate ${parsed.proximityGate}%`);

  // ── Free text: title, description, location, AND agent name ───────────────
  if (parsed.freeText) {
    q = q.or(
      [
        `title.ilike.%${parsed.freeText}%`,
        `description.ilike.%${parsed.freeText}%`,
        `location.ilike.%${parsed.freeText}%`,
        `agents.name.ilike.%${parsed.freeText}%`,
      ].join(','),
    );
  }

  // ── Apply structured filter store filters ─────────────────────────────────
  if (filters.genders.length > 0) {
    q = q.in('gender', filters.genders);
  }
  if (filters.amenities.length > 0) {
    filters.amenities.forEach((a) => {
      q = q.contains('amenities', [a]);
    });
  }
  if (filters.roomTypes.length > 0) {
    q = q.in('room_type_enum', filters.roomTypes);
  }
  if (filters.minPrice !== null) q = q.gte('price', filters.minPrice);
  if (filters.maxPrice !== null) q = q.lte('price', filters.maxPrice);
  if (filters.zones.length > 0) {
    q = q.in('area', filters.zones);
  }

  // ── Sort & paginate ───────────────────────────────────────────────────────
  q = parsed.sortByProximity
    ? q.order('proximity_description', { ascending: true })
    : q.order('created_at', { ascending: false });

  q = q.range(from, to);

  const { data, count } = await q;
  const results = (data as SearchListing[]) || [];

  // Admin-positioned listings always appear first
  results.sort((a, b) => {
    const aPos = a.sort_position ?? null;
    const bPos = b.sort_position ?? null;
    if (aPos !== null && bPos !== null) return aPos - bPos;
    if (aPos !== null) return -1;
    if (bPos !== null) return 1;
    return 0;
  });

  return { listings: results, count: count || 0 };
}

// ── Cascade Search ────────────────────────────────────────────────────────────
// 3 tiers: full query → structured filters only → all active hostels.
// Each tier = exactly 1 Supabase query (with LEFT JOINs). Max 3 queries total.

export async function cascadeSearch(
  filters: CombinedFilters,
  pageSize: number,
): Promise<CascadeResult> {
  const parsed = parseQuery(filters.searchText);
  const hasFreeText = !!parsed.freeText;
  const hasStructuredFilters =
    filters.genders.length > 0 ||
    filters.amenities.length > 0 ||
    filters.roomTypes.length > 0 ||
    filters.minPrice !== null ||
    filters.maxPrice !== null ||
    filters.zones.length > 0;

  // ── Tier 1: Full query (free text + all filters) ──────────────────────────
  const tier1Result = await fetchListings(filters, 0, pageSize - 1);
  if (tier1Result.count > 0) {
    return {
      ...tier1Result,
      tier: 1,
      effectiveFilters: filters,
      originalFreeText: parsed.freeText,
    };
  }

  // ── Tier 2: Structured filters only (drop free text) ──────────────────────
  if (hasFreeText && hasStructuredFilters) {
    const tier2Filters: CombinedFilters = {
      ...filters,
      searchText: '',
    };
    const tier2Result = await fetchListings(tier2Filters, 0, pageSize - 1);
    if (tier2Result.count > 0) {
      return {
        ...tier2Result,
        tier: 2,
        effectiveFilters: tier2Filters,
        originalFreeText: parsed.freeText,
      };
    }
  }

  // ── Tier 3: All active hostels (always returns results) ───────────────────
  const tier3Filters: CombinedFilters = {
    searchText: '',
    genders: [],
    amenities: [],
    roomTypes: [],
    minPrice: null,
    maxPrice: null,
    zones: [],
  };
  const tier3Result = await fetchListings(tier3Filters, 0, pageSize - 1);
  return {
    ...tier3Result,
    tier: 3,
    effectiveFilters: tier3Filters,
    originalFreeText: parsed.freeText,
  };
}
