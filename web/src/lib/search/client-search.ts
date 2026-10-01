import Fuse, { type IFuseOptions } from 'fuse.js';
import { parseQuery, ROOM_TYPES } from './parse-query';
import type { SearchListing, CombinedFilters } from './types';

// ── Types ─────────────────────────────────────────────────────────────────────

export interface ClientSearchResult {
  listings: SearchListing[];
  count: number;
  hasMore: boolean;
}

// ── Fuse.js fallback (used only when no deterministic match is found) ─────────

const FUSE_OPTIONS: IFuseOptions<SearchListing> = {
  keys: [
    { name: 'title', weight: 1.0 },
    { name: 'location', weight: 0.7 },
    { name: 'area', weight: 0.65 },
    { name: 'description', weight: 0.4 },
    { name: 'proximity_description', weight: 0.5 },
    { name: 'distance_to_campus', weight: 0.3 },
  ],
  threshold: 0.4,
  includeScore: true,
  minMatchCharLength: 2,
  ignoreLocation: true,
  findAllMatches: true,
};

let fuseIndex: Fuse<SearchListing> | null = null;
let fuseListings: SearchListing[] | null = null;

function getFuse(listings: SearchListing[]): Fuse<SearchListing> {
  if (fuseListings === listings && fuseIndex) return fuseIndex;
  fuseListings = listings;
  fuseIndex = new Fuse(listings, FUSE_OPTIONS);
  return fuseIndex;
}

// ── Normalization + per-listing search index (built once per payload) ────────

function normalize(s: string): string {
  return s.toLowerCase().replace(/\s+/g, ' ').trim();
}

interface ListingIndex {
  normTitle: string;
  titleTokens: string[];
  fieldHaystack: string;
}

let idxCache: { listings: SearchListing[]; index: Map<string, ListingIndex> } | null = null;

function getIndex(listings: SearchListing[]): Map<string, ListingIndex> {
  if (idxCache && idxCache.listings === listings) return idxCache.index;
  const index = new Map<string, ListingIndex>();
  for (const l of listings) {
    const normTitle = normalize(l.title ?? '');
    index.set(l.id, {
      normTitle,
      titleTokens: normTitle.split(' ').filter(Boolean),
      fieldHaystack: normalize(
        [l.area, l.specific_location, l.location, l.description].filter(Boolean).join(' '),
      ),
    });
  }
  idxCache = { listings, index };
  return index;
}

// ── Room-type filter fallback ────────────────────────────────────────────────
// room_type_enum is empty in the current data, so a hard enum filter returns
// zero results. Fall back to matching the display room_type / title /
// description against the same synonym groups the parser uses.

function matchesRoomTypeText(listing: SearchListing, roomTypeValue: string): boolean {
  const group = ROOM_TYPES.find(([, value]) => value === roomTypeValue);
  if (!group) return false;
  const haystack = normalize(
    [listing.title, listing.room_type, listing.description].filter(Boolean).join(' '),
  );
  return group[0].some((pattern) => haystack.includes(pattern));
}

// ── Structured filter matching ───────────────────────────────────────────────

function matchesStructuredFilters(listing: SearchListing, filters: CombinedFilters): boolean {
  if (filters.genders.length > 0) {
    if (!listing.gender || !filters.genders.includes(listing.gender)) return false;
  }

  if (filters.amenities.length > 0) {
    const listingAmenities = listing.amenities ?? [];
    for (const required of filters.amenities) {
      if (required === 'Hot Water') { if (!listing.hot_water_included) return false; }
      else if (required === 'Cooking Gas') { if (!listing.cooking_gas_included) return false; }
      else if (required === 'Water') { if (!listing.water_included) return false; }
      else if (required === 'Electricity') { if (!listing.electricity_included) return false; }
      else if (required === 'WiFi') { if (!listing.wifi_included) return false; }
      else { if (!listingAmenities.includes(required)) return false; }
    }
  }

  if (filters.roomTypes.length > 0) {
    const roomOk = filters.roomTypes.some(
      (rt) => listing.room_type_enum === rt || matchesRoomTypeText(listing, rt),
    );
    if (!roomOk) return false;
  }

  if (filters.minPrice !== null) {
    if (listing.price < filters.minPrice) return false;
  }

  if (filters.maxPrice !== null) {
    if (listing.price > filters.maxPrice) return false;
  }

  if (filters.zones.length > 0) {
    if (!listing.area || !filters.zones.includes(listing.area)) return false;
  }

  return true;
}

function matchesParsedFilters(listing: SearchListing, parsed: ReturnType<typeof parseQuery>): boolean {
  if (parsed.gender && listing.gender !== parsed.gender) return false;

  if (parsed.roomType) {
    const roomOk =
      listing.room_type_enum === parsed.roomType || matchesRoomTypeText(listing, parsed.roomType);
    if (!roomOk) return false;
  }

  if (parsed.area && listing.area !== parsed.area) return false;

  if (parsed.amenities.length > 0) {
    const listingAmenities = listing.amenities ?? [];
    for (const a of parsed.amenities) {
      if (a === 'Hot Water') { if (!listing.hot_water_included) return false; }
      else if (a === 'Cooking Gas') { if (!listing.cooking_gas_included) return false; }
      else if (a === 'Water') { if (!listing.water_included) return false; }
      else if (a === 'Electricity') { if (!listing.electricity_included) return false; }
      else if (a === 'WiFi') { if (!listing.wifi_included) return false; }
      else { if (!listingAmenities.includes(a)) return false; }
    }
  }

  if (parsed.maxPrice) {
    if (listing.price > parsed.maxPrice) return false;
  }

  if (parsed.minPrice) {
    if (listing.price < parsed.minPrice) return false;
  }

  if (parsed.exactPrice) {
    if (listing.price < parsed.exactPrice - 500 || listing.price > parsed.exactPrice + 500) return false;
  }

  if (parsed.proximityGate) {
    const pd = (listing.proximity_description ?? '').toLowerCase();
    if (!pd.includes(`gate ${parsed.proximityGate.toLowerCase()}`)) return false;
  }

  return true;
}

// Admin-pinned listings (sort_position set) tie-break ahead of the default
// newest-first order. Used only as a secondary signal so relevance always wins.
function bySortPosition(a: SearchListing, b: SearchListing): number {
  const aPos = a.sort_position ?? null;
  const bPos = b.sort_position ?? null;
  if (aPos !== null && bPos !== null) return aPos - bPos;
  if (aPos !== null) return -1;
  if (bPos !== null) return 1;
  return 0;
}

function sortByAdminOrder(listings: SearchListing[]): SearchListing[] {
  return [...listings].sort(bySortPosition);
}

// ── Deterministic relevance scoring ──────────────────────────────────────────
// Priority (lower level = higher relevance):
//   0  exact title match
//   1  title starts with the full query ("alpha hostel" → "alpha hostels")
//   2  single token equals a title token ("beta" → "BETA HOUSE")
//   3  single token is a prefix of a title token ("bet" → "beta")
//   4  query is a substring of the title, or every token matches in the title
//   5  some tokens match in the title, the rest in other fields
//   6  all tokens matched, but only in non-title fields
// Listings where any query token has no match anywhere are excluded (AND).

interface ScoredListing {
  listing: SearchListing;
  level: number;
  titleMatches: number;
}

function gradeToken(token: string, idx: ListingIndex): number | null {
  if (idx.titleTokens.includes(token)) return 1;
  if (token.length >= 2 && idx.titleTokens.some((t) => t.startsWith(token))) return 2;
  if (token.length >= 3 && idx.normTitle.includes(token)) return 3;
  if (token.length >= 3 && idx.fieldHaystack.includes(token)) return 4;
  return null;
}

function scoreListing(
  listing: SearchListing,
  idx: ListingIndex,
  query: string,
  tokens: string[],
): ScoredListing | null {
  if (!query) return null;

  const grades = tokens.map((t) => gradeToken(t, idx));
  if (grades.some((g) => g === null)) return null;

  const titleMatches = grades.filter((g) => g === 1 || g === 2).length;

  let level: number;
  if (idx.normTitle === query) {
    level = 0;
  } else if (idx.normTitle.startsWith(query)) {
    level = 1;
  } else if (tokens.length === 1) {
    const g = grades[0];
    if (g === 1) level = 2;
    else if (g === 2) level = 3;
    else if (g === 3) level = 4;
    else level = 6;
  } else {
    const allInTitle = grades.every((g) => g === 1 || g === 2 || g === 3);
    const anyInTitle = grades.some((g) => g === 1 || g === 2);
    if (allInTitle) level = 4;
    else if (anyInTitle) level = 5;
    else level = 6;
  }

  return { listing, level, titleMatches };
}

// ── Main search ───────────────────────────────────────────────────────────────

export function clientSearch(
  allListings: SearchListing[],
  filters: CombinedFilters,
  pageSize: number,
  offset: number,
): ClientSearchResult {
  const parsed = parseQuery(filters.searchText);
  const freeText = parsed.freeText;

  // Step 1: Apply structured filters from filter store + NLP-parsed filters
  let candidates = allListings.filter(
    (l) => matchesStructuredFilters(l, filters) && matchesParsedFilters(l, parsed),
  );

  // Step 2: Text search + relevance ranking
  let ranked: SearchListing[];
  const trimmed = freeText.trim();

  if (trimmed.length >= 2) {
    const query = normalize(freeText);
    // Tokens shorter than 2 chars are noise — ignore them for AND matching.
    const tokens = query.split(' ').filter((w) => w.length >= 2);
    const index = getIndex(allListings);

    const scored: ScoredListing[] = [];
    for (const l of candidates) {
      const idx = index.get(l.id);
      if (!idx) continue;
      const s = scoreListing(l, idx, query, tokens);
      if (s) scored.push(s);
    }

    if (scored.length > 0) {
      scored.sort((a, b) => {
        if (a.level !== b.level) return a.level - b.level;
        if (a.titleMatches !== b.titleMatches) return b.titleMatches - a.titleMatches;
        return bySortPosition(a.listing, b.listing);
      });
      ranked = scored.map((s) => s.listing);
    } else {
      // No deterministic match — fall back to fuzzy (handles typos / spelling).
      // The Fuse index is cached on the full payload; results are then
      // restricted to the structured-filter candidates.
      const candidateIds = new Set(candidates.map((c) => c.id));
      ranked = getFuse(allListings)
        .search(freeText)
        .filter((r) => candidateIds.has(r.item.id))
        .map((r) => r.item);
    }
  } else if (trimmed.length === 1) {
    // Single character: simple case-insensitive contains across key fields
    const term = freeText.toLowerCase();
    ranked = candidates.filter((l) => {
      const title = (l.title ?? '').toLowerCase();
      const location = (l.location ?? '').toLowerCase();
      const area = (l.area ?? '').toLowerCase();
      const desc = (l.description ?? '').toLowerCase();
      return title.includes(term) || location.includes(term) || area.includes(term) || desc.includes(term);
    });
  } else {
    // No text query — admin sort order applies (editorial pinning).
    ranked = candidates;
  }

  // Step 3: Admin order is the tie-break only; relevance was decided above.
  const sorted = trimmed.length >= 2 ? ranked : sortByAdminOrder(ranked);

  // Step 4: Paginate
  const paginated = sorted.slice(offset, offset + pageSize);

  return {
    listings: paginated,
    count: sorted.length,
    hasMore: offset + pageSize < sorted.length,
  };
}
