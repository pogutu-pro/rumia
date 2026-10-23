// Explore's refinements and ordering on top of clientSearch(): kind of place, bathroom, distance and sort.
// Pure functions over the in-memory listing payload, so filter counts and "Show N places" are exact.

import { getStartingPrice } from '@/lib/utils/starting-price';
import { ROOM_TYPES } from './parse-query';
import type { SearchListing } from './types';
import type { ExploreRefinements, ExploreSort } from '@/stores/filter-store';

/** Distance categories, nearest first. Unknown distances sort last and never pass a distance filter. */
const DISTANCE_RANK: Record<string, number> = {
  'walking-500m': 1,
  '5-10min': 2,
  '1-2km': 3,
  '3km': 4,
  'over-3km': 5,
};
const UNKNOWN_DISTANCE = 99;

export function distanceRank(category: string | null | undefined): number {
  return (category && DISTANCE_RANK[category]) || UNKNOWN_DISTANCE;
}

export function kindOf(listing: Pick<SearchListing, 'property_type'>): 'hostel' | 'apartment' | 'short_stay' {
  return listing.property_type ?? 'hostel';
}

/** The "from" rent the card and the property page show; price filters use this same number. */
export function startingPrice(listing: SearchListing): number {
  return getStartingPrice(listing, listing.listing_room_types);
}

type Refinements = Pick<ExploreRefinements, 'propertyType' | 'bathroom' | 'distance'> & {
  roomTypes?: string[];
  minPrice?: number | null;
  maxPrice?: number | null;
};

export function matchesRefinements(listing: SearchListing, r: Refinements): boolean {
  if (r.propertyType && kindOf(listing) !== r.propertyType) return false;
  if (r.roomTypes?.length && !r.roomTypes.some((v) => offersRoomType(listing, v))) return false;
  if (r.minPrice != null || r.maxPrice != null) {
    const price = startingPrice(listing);
    if (r.minPrice != null && price < r.minPrice) return false;
    if (r.maxPrice != null && price > r.maxPrice) return false;
  }
  if (r.bathroom && (listing.bathroom_type ?? '').toLowerCase() !== r.bathroom) return false;
  if (r.distance) {
    const max = r.distance === 'walk' ? DISTANCE_RANK['5-10min'] : DISTANCE_RANK['1-2km'];
    if (distanceRank(listing.distance_category) > max) return false;
  }
  return true;
}

/** Stable: listings that tie keep the order clientSearch gave them (relevance, then admin pinning). */
export function sortListings(listings: SearchListing[], sort: ExploreSort): SearchListing[] {
  if (sort === 'recommended') return listings;
  const order = new Map(listings.map((l, i) => [l.id, i]));
  const tie = (a: SearchListing, b: SearchListing) => (order.get(a.id) ?? 0) - (order.get(b.id) ?? 0);
  const by: Record<Exclude<ExploreSort, 'recommended'>, (a: SearchListing, b: SearchListing) => number> = {
    price_asc: (a, b) => startingPrice(a) - startingPrice(b) || tie(a, b),
    price_desc: (a, b) => startingPrice(b) - startingPrice(a) || tie(a, b),
    nearest: (a, b) => distanceRank(a.distance_category) - distanceRank(b.distance_category) || tie(a, b),
    newest: (a, b) => (b.created_at ?? '').localeCompare(a.created_at ?? '') || tie(a, b),
  };
  return [...listings].sort(by[sort]);
}

export const SORT_LABELS: Record<ExploreSort, string> = {
  recommended: 'Recommended',
  price_asc: 'Lowest price',
  price_desc: 'Highest price',
  nearest: 'Nearest to campus',
  newest: 'Newest',
};

/** Room-type choices, in the search parser's vocabulary, that at least one listing actually offers. */
const ROOM_LABELS: Record<string, string> = {
  bedsitter: 'Bedsitter',
  single: 'Single room',
  self_contained_bedsitter: 'Self-contained',
  double: 'Double room',
  shared: 'Shared room',
  one_bedroom: '1 bedroom',
  two_bedroom: '2 bedroom',
  three_bedroom: '3 bedroom',
};

export function roomTypeLabel(value: string): string {
  return ROOM_LABELS[value] ?? value;
}

/**
 * What the listing says its rooms are: its own room type and every room it lists. Titles and descriptions are not
 * read: "a single bed" in a description is not a single room, and many bedsitters only say so in their rooms.
 * A listing with no room information at all falls back to its title.
 */
function roomHaystack(l: SearchListing): string {
  const rooms = [l.room_type, ...(l.listing_room_types ?? []).map((r) => r.room_type)].filter(Boolean);
  return (rooms.length ? rooms : [l.title]).join(' | ').toLowerCase();
}

export function offersRoomType(l: SearchListing, value: string): boolean {
  const group = ROOM_TYPES.find(([, v]) => v === value);
  if (!group) return false;
  const hay = roomHaystack(l);
  return l.room_type_enum === value || group[0].some((p) => hay.includes(p));
}

export interface Option {
  value: string;
  label: string;
  count: number;
}

export function roomTypeOptions(listings: SearchListing[]): Option[] {
  return ROOM_TYPES.map(([, value]) => ({
    value,
    label: roomTypeLabel(value),
    count: listings.filter((l) => offersRoomType(l, value)).length,
  })).filter((o) => o.count > 0);
}

/** Listing amenities (and bills) that appear in the data, most common first. */
export function amenityOptions(listings: SearchListing[]): Option[] {
  const counts = new Map<string, number>();
  for (const l of listings) for (const a of new Set(l.amenities ?? [])) counts.set(a, (counts.get(a) ?? 0) + 1);
  return [...counts.entries()]
    .filter(([name]) => !['WiFi', 'Water', 'Electricity'].includes(name)) // shown under "Bills included"
    .sort((a, b) => b[1] - a[1])
    .map(([value, count]) => ({ value, label: value, count }));
}

export function areaOptions(listings: SearchListing[]): Option[] {
  const counts = new Map<string, number>();
  for (const l of listings) if (l.area) counts.set(l.area, (counts.get(l.area) ?? 0) + 1);
  return [...counts.entries()].sort((a, b) => b[1] - a[1]).map(([value, count]) => ({ value, label: value, count }));
}

/** Up to three facts a card shows under the place line. Only what the listing states; nothing inferred. */
export function cardHighlights(l: SearchListing): string[] {
  const out: string[] = [];
  if (l.wifi_included) out.push('WiFi included');
  if (l.water_included) out.push('Water included');
  if ((l.bathroom_type ?? '').toLowerCase() === 'private') out.push('Private bathroom');
  else if (l.electricity_included) out.push('Electricity included');
  return out.slice(0, 3);
}

/** "Bedsitter" from "Bedsitter - Ground floor, 1 person"; "Apartment" for apartments. */
export function cardKind(l: SearchListing): string {
  if (kindOf(l) === 'apartment') return 'Apartment';
  const first = (l.room_type ?? '').split(' - ')[0].trim();
  return first || 'Hostel';
}
