import Fuse, { type IFuseOptions } from 'fuse.js';
import { parseQuery } from './parse-query';
import type { SearchListing, CombinedFilters } from './cascade-search';

// ── Types ─────────────────────────────────────────────────────────────────────

export interface ClientSearchResult {
  listings: SearchListing[];
  count: number;
  hasMore: boolean;
}

// ── Fuse.js index (built once, reused) ────────────────────────────────────────

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

// ── Helpers ───────────────────────────────────────────────────────────────────

function matchesStructuredFilters(listing: SearchListing, filters: CombinedFilters): boolean {
  if (filters.genders.length > 0) {
    if (!listing.gender || !filters.genders.includes(listing.gender)) return false;
  }

  if (filters.amenities.length > 0) {
    const listingAmenities = listing.amenities ?? [];
    for (const required of filters.amenities) {
      if (!listingAmenities.includes(required)) return false;
    }
  }

  if (filters.roomTypes.length > 0) {
    if (!listing.room_type_enum || !filters.roomTypes.includes(listing.room_type_enum)) return false;
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

  if (parsed.roomType && listing.room_type_enum !== parsed.roomType) return false;

  if (parsed.area && listing.area !== parsed.area) return false;

  if (parsed.amenities.length > 0) {
    const listingAmenities = listing.amenities ?? [];
    for (const a of parsed.amenities) {
      if (!listingAmenities.includes(a)) return false;
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

function sortResults(listings: SearchListing[]): SearchListing[] {
  return [...listings].sort((a, b) => {
    const aPos = a.sort_position ?? null;
    const bPos = b.sort_position ?? null;
    if (aPos !== null && bPos !== null) return aPos - bPos;
    if (aPos !== null) return -1;
    if (bPos !== null) return 1;
    return 0;
  });
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

  // Step 2: Text search
  if (freeText && freeText.trim().length >= 2) {
    const fuse = getFuse(candidates);
    const fuseResults = fuse.search(freeText);
    candidates = fuseResults.map((r) => r.item);
  } else if (freeText && freeText.trim().length === 1) {
    // Single character: simple case-insensitive contains across key fields
    const term = freeText.toLowerCase();
    candidates = candidates.filter((l) => {
      const title = (l.title ?? '').toLowerCase();
      const location = (l.location ?? '').toLowerCase();
      const area = (l.area ?? '').toLowerCase();
      const desc = (l.description ?? '').toLowerCase();
      return title.includes(term) || location.includes(term) || area.includes(term) || desc.includes(term);
    });
  }

  // Step 3: Sort
  const sorted = sortResults(candidates);

  // Step 4: Paginate
  const paginated = sorted.slice(offset, offset + pageSize);

  return {
    listings: paginated,
    count: sorted.length,
    hasMore: offset + pageSize < sorted.length,
  };
}
