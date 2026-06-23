'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import { Search, MapPin, Eye, X, SlidersHorizontal } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { createClient } from '@/lib/supabase/client';
import { useDebounce } from '@/hooks/use-debounce';
import { useMediaQuery } from '@/hooks/use-media-query';
import { getDistanceBadgeText } from '@/lib/constants/dekut-areas';
import { EarlyAccessBanner } from '@/components/feedback/early-access-banner';
import { useFilterStore, type FilterState } from '@/stores/filter-store';
import { FilterSidebar } from '@/components/ui/filter/filter-sidebar';
import { FilterBottomSheet } from '@/components/ui/filter/filter-bottom-sheet';
import { ActiveFilterChips } from '@/components/ui/filter/active-filter-chips';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet';

// ── Types ─────────────────────────────────────────────────────────────────────

interface ParsedFilters {
  maxPrice?: number;
  exactPrice?: number;
  gender?: 'male' | 'female';
  roomType?: string;
  amenities: string[];
  area?: string;
  proximityGate?: 'A' | 'B';
  sortByProximity: boolean;
  freeText: string;
}

export interface Listing {
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
  listing_images: { r2_url: string; display_order: number }[];
  agents: { name: string } | null;
}

interface CombinedFilters {
  searchText: string;
  genders: string[];
  amenities: string[];
  roomTypes: string[];
  minPrice: number | null;
  maxPrice: number | null;
  zones: string[];
}

// ── Smart Search Parser ───────────────────────────────────────────────────────

const PRICE_WORDS = ['cheap', 'affordable', 'budget'];
const GENDER_FEMALE = ['ladies', 'girls', 'female'];
const GENDER_MALE = ['gents', 'boys', 'male'];
const AREA_KEYWORDS: [string[], string][] = [
  [['near gate a', 'gate a'], 'Near Gate A'],
  [['near gate b', 'gate b'], 'Near Gate B'],
  [['boma'], 'Boma'],
  [['nyeri view'], 'Nyeri View'],
  [['kahawa ridge'], 'Kahawa Ridge'],
  [['embassy'], 'Embassy Area'],
  [['nyaribo'], 'Nyaribo'],
];
const ROOM_TYPES: [string[], string][] = [
  [['self contained', 'ensuite'], 'self_contained'],
  [['bedsitter', 'bed sitter'], 'bedsitter'],
  [['single room', 'single'], 'single'],
  [['double room', 'double'], 'double'],
  [['shared'], 'shared'],
];
const AMENITY_MAP: [string[], string][] = [
  [['wifi', 'internet'], 'WiFi'],
  [['water'], 'Water'],
  [['electricity', 'power'], 'Electricity'],
  [['parking'], 'Parking'],
  [['security', 'guard'], 'Security'],
  [['furnished'], 'Furnished'],
  [['washing', 'laundry'], 'Laundry Area'],
];

function parseQuery(input: string): ParsedFilters {
  const lower = input.toLowerCase();
  const filters: ParsedFilters = {
    amenities: [],
    sortByProximity: false,
    freeText: '',
  };
  let remaining = lower;

  if (PRICE_WORDS.some((w) => lower.includes(w))) {
    filters.maxPrice = 5000;
    PRICE_WORDS.forEach((w) => {
      remaining = remaining.replace(w, '');
    });
  }

  const underMatch = remaining.match(/(?:under|below)\s+(\d+\.?\d*)\s*k?/);
  if (underMatch) {
    const num = parseFloat(underMatch[1]);
    filters.maxPrice =
      underMatch[0].includes('k') && num < 1000 ? num * 1000 : num;
    remaining = remaining.replace(underMatch[0], '');
  }

  if (!filters.maxPrice) {
    const numMatch = remaining.match(/\b(\d{3,6})\b/);
    if (numMatch) {
      const num = parseInt(numMatch[1], 10);
      if (num >= 500 && num <= 100000) {
        filters.exactPrice = num;
        remaining = remaining.replace(numMatch[0], '');
      }
    }
  }

  if (GENDER_FEMALE.some((w) => lower.includes(w))) {
    filters.gender = 'female';
    GENDER_FEMALE.forEach((w) => {
      remaining = remaining.replace(w, '');
    });
  } else if (GENDER_MALE.some((w) => lower.includes(w))) {
    filters.gender = 'male';
    GENDER_MALE.forEach((w) => {
      remaining = remaining.replace(w, '');
    });
  }

  for (const [patterns, value] of ROOM_TYPES) {
    for (const p of patterns) {
      if (lower.includes(p)) {
        filters.roomType = value;
        remaining = remaining.replace(p, '');
        break;
      }
    }
    if (filters.roomType) break;
  }

  for (const [patterns, label] of AMENITY_MAP) {
    for (const p of patterns) {
      if (lower.includes(p)) {
        if (!filters.amenities.includes(label)) filters.amenities.push(label);
        remaining = remaining.replace(p, '');
      }
    }
  }

  for (const [patterns, areaName] of AREA_KEYWORDS) {
    for (const p of patterns) {
      if (lower.includes(p)) {
        filters.area = areaName;
        remaining = remaining.replace(p, '');
        break;
      }
    }
    if (filters.area) break;
  }

  if (lower.includes('gate a')) {
    filters.proximityGate = 'A';
    remaining = remaining.replace('gate a', '');
  } else if (lower.includes('gate b')) {
    filters.proximityGate = 'B';
    remaining = remaining.replace('gate b', '');
  }
  if (lower.includes('near campus') || lower.includes('close to campus')) {
    filters.sortByProximity = true;
    remaining = remaining.replace(/near campus|close to campus/g, '');
  }

  filters.freeText = remaining.replace(/\s+/g, ' ').trim();
  return filters;
}

// ── Supabase Query ────────────────────────────────────────────────────────────

async function fetchListings(filters: CombinedFilters): Promise<Listing[]> {
  const supabase = createClient();
  let q = supabase
    .from('listings')
    .select(
      'id, title, description, price, location, slug, county, area, gender, specific_location, price_single, price_sharing, distance_category, listing_images(r2_url, display_order), agents(name)',
    )
    .eq('is_active', true);

  const parsed = parseQuery(filters.searchText);

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
  if (parsed.freeText) {
    q = q.or(
      `title.ilike.%${parsed.freeText}%,description.ilike.%${parsed.freeText}%,location.ilike.%${parsed.freeText}%`,
    );
  }

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

  q = parsed.sortByProximity
    ? q.order('proximity_description', { ascending: true })
    : q.order('created_at', { ascending: false });

  const { data } = await q;
  return (data as Listing[]) || [];
}

// ── Skeleton ──────────────────────────────────────────────────────────────────

function ListingSkeleton() {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
      {Array.from({ length: 6 }).map((_, i) => (
        <div
          key={i}
          className="bg-white border border-slate-100 rounded-2xl overflow-hidden animate-pulse"
        >
          <div className="aspect-4/3 bg-slate-200" />
          <div className="p-4 space-y-2">
            <div className="h-3 bg-slate-200 rounded w-1/2" />
            <div className="h-4 bg-slate-200 rounded w-3/4" />
            <div className="h-3 bg-slate-200 rounded w-full" />
            <div className="h-3 bg-slate-200 rounded w-2/3" />
          </div>
        </div>
      ))}
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────

interface HostelsSearchProps {
  initialListings: Listing[];
}

export default function HostelsSearch({ initialListings }: HostelsSearchProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const isDesktop = useMediaQuery('(min-width: 1024px)');
  const hydrationDone = useRef(false);

  const initialQuery = searchParams.get('q') ?? '';
  const [query, setQuery] = useState(initialQuery);
  const [listings, setListings] = useState<Listing[]>(
    initialQuery ? [] : initialListings,
  );
  const [loading, setLoading] = useState(!!initialQuery);
  const [desktopFilterOpen, setDesktopFilterOpen] = useState(false);

  const {
    genders,
    amenities,
    roomTypes,
    minPrice,
    maxPrice,
    zones,
    setGenders,
    setAmenities,
    setRoomTypes,
    setPriceRange,
    setZones,
    reset,
    hydrateFromParams,
    toParams,
  } = useFilterStore();

  const debouncedQuery = useDebounce(query, 300);

  useEffect(() => {
    if (!hydrationDone.current && searchParams.toString()) {
      hydrateFromParams(searchParams);
      hydrationDone.current = true;
    }
  }, [searchParams, hydrateFromParams]);

  const filters: FilterState = {
    genders,
    amenities,
    roomTypes,
    minPrice,
    maxPrice,
    zones,
  };

  const buildCombinedFilters = useCallback(
    (searchText: string): CombinedFilters => ({
      searchText,
      genders,
      amenities,
      roomTypes,
      minPrice,
      maxPrice,
      zones,
    }),
    [genders, amenities, roomTypes, minPrice, maxPrice, zones],
  );

  const runSearch = useCallback(
    async (searchText: string) => {
      setLoading(true);
      const combined = buildCombinedFilters(searchText);
      const results = await fetchListings(combined);
      setListings(results);
      setLoading(false);
    },
    [buildCombinedFilters],
  );

  useEffect(() => {
    const filterParams = toParams();
    const qParam = debouncedQuery
      ? `q=${encodeURIComponent(debouncedQuery)}`
      : '';
    const filterStr = filterParams.toString();
    const url =
      qParam || filterStr
        ? `/hostels?${[qParam, filterStr].filter(Boolean).join('&')}`
        : '/hostels';
    router.replace(url, { scroll: false });
    runSearch(debouncedQuery);
  }, [
    debouncedQuery,
    genders,
    amenities,
    roomTypes,
    minPrice,
    maxPrice,
    zones,
    router,
    runSearch,
    toParams,
  ]);

  const handleClearAll = useCallback(() => {
    reset();
    setQuery('');
  }, [reset]);

  const handleMobileApply = useCallback(
    (draft: FilterState) => {
      setGenders(draft.genders);
      setAmenities(draft.amenities);
      setRoomTypes(draft.roomTypes);
      setPriceRange(draft.minPrice, draft.maxPrice);
      setZones(draft.zones);
    },
    [setGenders, setAmenities, setRoomTypes, setPriceRange, setZones],
  );

  const activeFilterCount =
    genders.length +
    amenities.length +
    roomTypes.length +
    (minPrice || maxPrice ? 1 : 0) +
    zones.length;

  const parsedSmart = parseQuery(debouncedQuery);
  const hasSmartFilters =
    !!parsedSmart.freeText ||
    !!parsedSmart.maxPrice ||
    !!parsedSmart.gender ||
    !!parsedSmart.roomType ||
    parsedSmart.amenities.length > 0;
  const hasAnyFilters = activeFilterCount > 0 || hasSmartFilters;

  const emptyMessage = () => {
    const parts: string[] = [];
    const parsed = parseQuery(debouncedQuery);
    if (parsed.gender)
      parts.push(parsed.gender === 'female' ? 'ladies only' : 'gents only');
    if (parsed.maxPrice)
      parts.push(`under KES ${parsed.maxPrice.toLocaleString()}`);
    if (parsed.exactPrice)
      parts.push(`~KES ${parsed.exactPrice.toLocaleString()}`);
    if (parsed.roomType) parts.push(parsed.roomType.replace('_', ' '));
    parsed.amenities.forEach((a) => parts.push(a.toLowerCase()));
    if (parsed.freeText) parts.push(`"${parsed.freeText}"`);
    if (genders.length) parts.push(`gender: ${genders.join(' or ')}`);
    if (amenities.length) parts.push(`amenities: ${amenities.join(', ')}`);
    if (roomTypes.length) parts.push(`type: ${roomTypes.join(', ')}`);
    if (minPrice || maxPrice)
      parts.push(`price: ${minPrice ?? 0}–${maxPrice ?? '∞'}`);
    if (zones.length) parts.push(`zones: ${zones.join(', ')}`);
    return parts.length
      ? `No hostels found for ${parts.join(', ')}. Try removing some filters above.`
      : 'No hostels found. Check back soon.';
  };

  return (
    <div className="min-h-screen bg-slate-50/50 py-6 lg:py-10">
      <div className="mx-auto max-w-6xl px-4 lg:px-8">
        {/* Header */}
        <div className="mb-5">
          <h1 className="text-2xl lg:text-3xl font-black text-slate-900 tracking-tight">
            Student Hostels Near DeKUT
          </h1>
          <p className="text-slate-500 font-medium mt-1 text-sm lg:text-base">
            Type anything — room type, price, amenities, or location.
          </p>
        </div>

        {/* Search Input */}
        <div className="relative mb-3">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-400 pointer-events-none" />
          <Input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder='e.g. "cheap ladies wifi gate A" or "self contained near campus"'
            className="pl-12 h-13 text-base bg-white border-slate-200 focus-visible:ring-emerald-500 rounded-2xl shadow-sm"
          />
          {query && (
            <button
              type="button"
              onClick={() => setQuery('')}
              className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700 transition-colors cursor-pointer"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>

        {/* Filter toolbar: button + active chips + results count */}
        <div className="mb-5 space-y-3">
          {/* Top row: filter button */}
          <div className="flex flex-wrap items-center gap-3">
            {/* Desktop filter trigger */}
            {isDesktop ? (
              <Sheet
                open={desktopFilterOpen}
                onOpenChange={setDesktopFilterOpen}
              >
                <SheetTrigger asChild>
                  <button
                    type="button"
                    className="inline-flex items-center gap-2 rounded-xl px-5 py-2.5 text-sm font-semibold transition-all duration-200 cursor-pointer bg-emerald-500 text-white shadow-sm shadow-emerald-200 hover:bg-emerald-600"
                  >
                    <SlidersHorizontal className="h-4 w-4" />
                    Filters
                    {activeFilterCount > 0 && (
                      <span className="inline-flex h-5 min-w-[20px] items-center justify-center rounded-full bg-white/20 px-1.5 text-xs font-bold">
                        {activeFilterCount}
                      </span>
                    )}
                  </button>
                </SheetTrigger>
                <SheetContent
                  side="left"
                  className="w-[320px] p-0 overflow-y-auto"
                >
                  <SheetHeader className="px-5 py-4 border-b border-slate-100">
                    <SheetTitle className="text-left text-base font-bold text-slate-900">
                      Filters
                    </SheetTitle>
                  </SheetHeader>
                  <div className="p-5">
                    <FilterSidebar
                      filters={filters}
                      onSetGenders={setGenders}
                      onSetAmenities={setAmenities}
                      onSetRoomTypes={setRoomTypes}
                      onSetPriceRange={setPriceRange}
                      onSetZones={setZones}
                    />
                  </div>
                </SheetContent>
              </Sheet>
            ) : (
              <FilterBottomSheet
                currentFilters={filters}
                onApply={handleMobileApply}
              />
            )}

            {/* Results count — inline on desktop, below on mobile */}
            {isDesktop && (
              <p className="text-sm text-slate-400 font-semibold">
                {loading ? (
                  <span className="text-slate-300">Searching...</span>
                ) : (
                  <>
                    {listings.length}{' '}
                    {listings.length === 1 ? 'hostel' : 'hostels'} found
                  </>
                )}
                {hasAnyFilters && (
                  <span className="text-slate-300">
                    {' '}·{' '}
                    <button
                      type="button"
                      onClick={handleClearAll}
                      className="text-rose-400 hover:text-rose-500 cursor-pointer"
                    >
                      Clear all
                    </button>
                  </span>
                )}
              </p>
            )}
          </div>

          {/* Active filter chips */}
          <ActiveFilterChips
            filters={filters}
            onRemoveGender={(v) =>
              setGenders(genders.filter((g) => g !== v))
            }
            onRemoveAmenity={(v) =>
              setAmenities(amenities.filter((a) => a !== v))
            }
            onRemoveRoomType={(v) =>
              setRoomTypes(roomTypes.filter((r) => r !== v))
            }
            onRemovePrice={() => setPriceRange(null, null)}
            onRemoveZone={(v) => setZones(zones.filter((z) => z !== v))}
            onClearAll={handleClearAll}
          />
        </div>

        {/* Mobile results count */}
        {!isDesktop && !loading && (
          <p className="text-sm text-slate-400 font-semibold mb-5 px-1">
            {listings.length}{' '}
            {listings.length === 1 ? 'hostel' : 'hostels'} found
            {hasAnyFilters && (
              <span className="text-slate-300">
                {' '}·{' '}
                <button
                  type="button"
                  onClick={handleClearAll}
                  className="text-rose-400 hover:text-rose-500 cursor-pointer"
                >
                  Clear all
                </button>
              </span>
            )}
          </p>
        )}

        {/* Listing Grid */}
        {loading ? (
          <ListingSkeleton />
        ) : listings.length > 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {listings.map((item) => {
              const sorted = [...(item.listing_images || [])].sort(
                (a, b) => a.display_order - b.display_order,
              );
              const imageUrl =
                sorted[0]?.r2_url ??
                'https://images.unsplash.com/photo-1555854877-bab0e564b8d5?q=80&w=600';
              const href = item.slug
                ? `/hostels/${item.county ?? 'nyeri'}/${item.area ?? 'dekut'}/${item.slug}`
                : `/listing/${item.id}`;

              const distanceBadge = getDistanceBadgeText(
                item.distance_category,
              );

              let priceDisplay = `KES ${item.price.toLocaleString()}/mo`;
              if (item.price_single && item.price_sharing) {
                priceDisplay = `KES ${item.price_single.toLocaleString()} single · KES ${item.price_sharing.toLocaleString()} sharing`;
              } else if (item.price_single) {
                priceDisplay = `KES ${item.price_single.toLocaleString()}/mo single`;
              } else if (item.price_sharing) {
                priceDisplay = `KES ${item.price_sharing.toLocaleString()}/mo sharing`;
              }

              let areaDisplay = item.area || 'Hostel Area';
              if (item.specific_location) {
                areaDisplay = `${areaDisplay} · ${item.specific_location}`;
              }

              return (
                <Link
                  key={item.id}
                  href={href}
                  className="group flex flex-col bg-white border border-slate-100 rounded-2xl overflow-hidden hover:shadow-lg transition-all duration-300 h-full cursor-pointer"
                >
                  <div className="relative aspect-4/3 overflow-hidden bg-slate-100">
                    <Image
                      src={imageUrl}
                      alt={`${item.title} — student hostel near DeKUT`}
                      fill
                      className="object-cover transition-transform duration-500 group-hover:scale-105"
                      sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
                    />

                    {distanceBadge && (
                      <div className="absolute top-3 left-3 bg-slate-900/70 backdrop-blur-sm px-2.5 py-1 rounded-full text-xs font-bold shadow-xs text-white">
                        {distanceBadge}
                      </div>
                    )}

                    {item.gender && item.gender !== 'mixed' && (
                      <div
                        className={`absolute top-3 right-3 px-2.5 py-1 rounded-full text-xs font-bold shadow-xs text-white ${
                          item.gender === 'female'
                            ? 'bg-pink-600/90'
                            : 'bg-blue-600/90'
                        } backdrop-blur-sm`}
                      >
                        {item.gender === 'female'
                          ? 'Ladies Only'
                          : 'Gents Only'}
                      </div>
                    )}

                    {!item.area && (
                      <div className="absolute top-3 right-3 bg-white/95 backdrop-blur-xs px-2.5 py-1 rounded-lg text-xs font-bold shadow-xs text-slate-900 border border-slate-100/50">
                        {priceDisplay.split('/')[0]}
                      </div>
                    )}
                  </div>

                  <div className="p-4 flex-1 flex flex-col">
                    <h3 className="font-bold text-slate-900 line-clamp-1 group-hover:text-emerald-600 transition-colors">
                      {item.title}
                    </h3>

                    <div className="flex items-center gap-1 text-slate-500 text-xs font-semibold mt-1 mb-2 truncate">
                      <MapPin className="h-3 w-3 shrink-0" />
                      <span className="truncate">{areaDisplay}</span>
                    </div>

                    <p className="text-slate-500 text-xs line-clamp-2 mb-4 flex-1">
                      {item.description}
                    </p>

                    <div className="mb-3 pt-2 border-t border-slate-100">
                      <p className="text-sm font-bold text-emerald-600">
                        {priceDisplay}
                      </p>
                    </div>

                    <div className="border-t border-slate-100 pt-3 flex items-center justify-between text-xs text-slate-400">
                      <span>Agent: {item.agents?.name ?? 'Rumia Agent'}</span>
                      <span className="font-semibold text-emerald-600 group-hover:underline flex items-center gap-0.5 cursor-pointer">
                        <Eye className="h-3.5 w-3.5" /> View
                      </span>
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        ) : (
          <div className="text-center py-24 bg-white border border-slate-100 rounded-2xl">
            <p className="text-slate-500 font-semibold text-sm max-w-sm mx-auto">
              {emptyMessage()}
            </p>
            {activeFilterCount > 0 && (
              <button
                type="button"
                onClick={handleClearAll}
                className="mt-5 inline-flex items-center px-5 py-2.5 bg-slate-900 text-white rounded-xl text-sm font-semibold hover:bg-slate-800 transition-colors cursor-pointer"
              >
                Clear all filters
              </button>
            )}
          </div>
        )}

        <div className="mt-8">
          <EarlyAccessBanner />
        </div>
      </div>
    </div>
  );
}
