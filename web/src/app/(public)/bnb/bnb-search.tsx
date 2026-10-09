'use client';

import { useEffect, useState, useCallback, useRef, useMemo } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import {
  MapPin,
  SlidersHorizontal,
  Tag,
  X,
  Users,
  BedDouble,
  Bath,
  BadgeCheck,
} from 'lucide-react';
import { ListingSearchInput } from '@/components/ui/listing-search-input';
import { useDebounce } from '@/hooks/use-debounce';
import { useBnbFilterStore } from '@/stores/bnb-filter-store';
import { SaveButton } from '@/components/ui/save-button';
import { formatCurrency } from '@/lib/utils/currency';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet';
import { useMediaQuery } from '@/hooks/use-media-query';
import { FilterBottomSheet } from '@/components/ui/filter/filter-bottom-sheet';
import { PriceRangeFilter } from '@/components/ui/filter/price-range-filter';
import { AmenitiesFilter } from '@/components/ui/filter/amenities-filter';
import { Separator } from '@/components/ui/separator';
import type { FilterState } from '@/stores/filter-store';

const FALLBACK_BLUR =
  'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCA2MDAgNDUwIj48cmVjdCB3aWR0aD0iNjAwIiBoZWlnaHQ9IjQ1MCIgZmlsbD0iI2UyZThmMCIvPjwvc3ZnPg==';

export function BnbSearchSkeleton() {
  return (
    <div className="min-h-screen bg-slate-50/50 pb-10">
      <div className="mx-auto max-w-6xl px-4 py-5 lg:px-8">
        <div className="mb-5 h-12 animate-pulse rounded-2xl bg-slate-200/80" />
        <div className="mb-6 flex gap-2">
          <div className="h-9 w-24 animate-pulse rounded-full bg-slate-200/80" />
          <div className="h-9 w-20 animate-pulse rounded-full bg-slate-200/80" />
        </div>
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, index) => (
            <div
              key={index}
              className="overflow-hidden rounded-2xl border border-slate-100 bg-white"
            >
              <div className="aspect-[4/3] animate-pulse bg-slate-200/80" />
              <div className="space-y-3 p-4">
                <div className="h-4 w-3/4 animate-pulse rounded bg-slate-200/80" />
                <div className="h-3 w-1/2 animate-pulse rounded bg-slate-200/80" />
                <div className="h-3 w-2/3 animate-pulse rounded bg-slate-200/80" />
                <div className="mt-5 h-5 w-1/3 animate-pulse rounded bg-slate-200/80" />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export interface BnbListing {
  id: string;
  title: string;
  description: string;
  price: number;
  location: string;
  area?: string | null;
  county?: string | null;
  slug?: string | null;
  amenities?: string[] | null;
  property_type?: string | null;
  verified?: boolean | null;
  images?: { r2_url: string; display_order: number; blur_data_url?: string }[];
  agent?: { name: string } | null;
  bnb?: {
    max_guests?: number | null;
    bedrooms?: number | null;
    bathrooms?: number | null;
    price_unit?: string;
    listing_type?: string;
  } | null;
}

function normalize(s: string) {
  return s.toLowerCase().replace(/\s+/g, ' ').trim();
}

function matchesBnbFilters(
  item: BnbListing,
  query: string,
  amenities: string[],
  minPrice: number | null,
  maxPrice: number | null,
  locations: string[],
): boolean {
  if (minPrice !== null && item.price < minPrice) return false;
  if (maxPrice !== null && item.price > maxPrice) return false;

  if (amenities.length > 0) {
    const itemAmenities = item.amenities ?? [];
    for (const a of amenities) {
      if (!itemAmenities.includes(a)) return false;
    }
  }

  if (locations.length > 0) {
    const area = (item.area ?? '').toLowerCase();
    const loc = (item.location ?? '').toLowerCase();
    const matches = locations.some(
      (l) => area.includes(l.toLowerCase()) || loc.includes(l.toLowerCase()),
    );
    if (!matches) return false;
  }

  if (query.length >= 2) {
    const q = normalize(query);
    const haystack = normalize(
      [item.title, item.location, item.area, item.description]
        .filter(Boolean)
        .join(' '),
    );
    if (!haystack.includes(q)) return false;
  }

  return true;
}

function listingTypeLabel(type?: string | null) {
  if (type === 'private_room') return 'Private room';
  if (type === 'shared_space') return 'Shared space';
  return 'Entire place';
}

function priceUnitLabel(unit?: string | null) {
  if (unit === 'week') return '/ week';
  if (unit === 'month') return '/ month';
  return '/ night';
}

function BnbFilterSidebar({
  amenities,
  minPrice,
  maxPrice,
  onSetAmenities,
  onSetPriceRange,
}: {
  amenities: string[];
  minPrice: number | null;
  maxPrice: number | null;
  onSetAmenities: (v: string[]) => void;
  onSetPriceRange: (min: number | null, max: number | null) => void;
}) {
  return (
    <div className="space-y-6">
      <AmenitiesFilter selected={amenities} onChange={onSetAmenities} />
      <Separator />
      <PriceRangeFilter
        minPrice={minPrice}
        maxPrice={maxPrice}
        onChange={onSetPriceRange}
      />
    </div>
  );
}

interface BnbSearchProps {
  allListings: BnbListing[];
}

export default function BnbSearch({ allListings }: BnbSearchProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const isDesktop = useMediaQuery('(min-width: 1024px)');
  const hydrationDone = useRef(false);
  const [desktopFilterOpen, setDesktopFilterOpen] = useState(false);

  const qParamFromUrl = searchParams.get('q') ?? '';
  const [query, setQuery] = useState(qParamFromUrl);
  const debouncedQuery = useDebounce(query, 200);
  const [committedQuery, setCommittedQuery] = useState(qParamFromUrl);

  const {
    amenities,
    minPrice,
    maxPrice,
    locations,
    setAmenities,
    setPriceRange,
    reset,
    hydrateFromParams,
    toParams,
  } = useBnbFilterStore();

  useEffect(() => {
    if (!hydrationDone.current && searchParams.toString()) {
      hydrateFromParams(searchParams);
      hydrationDone.current = true;
    }
  }, [searchParams, hydrateFromParams]);

  useEffect(() => {
    const filterParams = toParams();
    const qParam = committedQuery
      ? `q=${encodeURIComponent(committedQuery)}`
      : '';
    const filterStr = filterParams.toString();
    const url =
      qParam || filterStr
        ? `/bnb?${[qParam, filterStr].filter(Boolean).join('&')}`
        : '/bnb';
    router.replace(url, { scroll: false });
  }, [
    committedQuery,
    amenities,
    minPrice,
    maxPrice,
    locations,
    router,
    toParams,
  ]);

  const filtered = useMemo(
    () =>
      allListings.filter((item) =>
        matchesBnbFilters(
          item,
          debouncedQuery,
          amenities,
          minPrice,
          maxPrice,
          locations,
        ),
      ),
    [allListings, debouncedQuery, amenities, minPrice, maxPrice, locations],
  );

  const INITIAL = 12;
  const BATCH = 12;
  const filterKey = JSON.stringify([
    debouncedQuery,
    amenities,
    minPrice,
    maxPrice,
    locations,
  ]);
  const [displayState, setDisplayState] = useState({ key: '', limit: INITIAL });
  const displayLimit =
    displayState.key === filterKey ? displayState.limit : INITIAL;
  const loadMoreRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (displayLimit >= filtered.length) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) {
          setDisplayState((prev) => {
            const cur = prev.key === filterKey ? prev.limit : INITIAL;
            return {
              key: filterKey,
              limit: Math.min(cur + BATCH, filtered.length),
            };
          });
        }
      },
      { rootMargin: '600px 0px' },
    );
    const target = loadMoreRef.current;
    if (target) observer.observe(target);
    return () => {
      if (target) observer.unobserve(target);
    };
  }, [filterKey, displayLimit, filtered.length]);

  const visible = useMemo(
    () => filtered.slice(0, displayLimit),
    [filtered, displayLimit],
  );

  const activeFilterCount =
    amenities.length + (minPrice || maxPrice ? 1 : 0) + locations.length;
  const hasAnyFilters = activeFilterCount > 0 || debouncedQuery.length > 0;

  const handleClearAll = useCallback(() => {
    reset();
    setQuery('');
    setCommittedQuery('');
  }, [reset]);

  const asFilterState: FilterState = {
    genders: [],
    amenities,
    roomTypes: [],
    minPrice,
    maxPrice,
    zones: locations,
    maxDistance: null,
    sortByNearest: false,
  };

  return (
    <div className="min-h-screen bg-slate-50/50 pb-8 lg:pb-10">
      <div className="mx-auto max-w-6xl px-4 lg:px-8">
        <div className="bg-white rounded-2xl shadow-[0_1px_14px_rgba(0,0,0,0.06)] border border-slate-100 p-3 sm:p-4 mb-4">
          <ListingSearchInput
            value={query}
            onChange={(v) => setQuery(v)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') setCommittedQuery(query);
            }}
            onBlur={() => setCommittedQuery(query)}
            onClear={() => {
              setQuery('');
              setCommittedQuery('');
            }}
          />

          <div className="flex flex-nowrap items-center gap-2 mt-3 overflow-x-auto scrollbar-none">
            {isDesktop ? (
              <Sheet
                open={desktopFilterOpen}
                onOpenChange={setDesktopFilterOpen}
              >
                <SheetTrigger asChild>
                  <button
                    type="button"
                    className="shrink-0 inline-flex items-center gap-1.5 rounded-full px-4 py-2 text-sm font-semibold transition-all duration-200 cursor-pointer bg-emerald-500 text-white shadow-sm shadow-emerald-200 hover:bg-emerald-600"
                  >
                    <SlidersHorizontal className="h-3.5 w-3.5" />
                    Filters
                    {activeFilterCount > 0 && (
                      <span className="ml-0.5 inline-flex h-5 min-w-[20px] items-center justify-center rounded-full bg-white/20 px-1.5 text-xs font-bold leading-none">
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
                    <BnbFilterSidebar
                      amenities={amenities}
                      minPrice={minPrice}
                      maxPrice={maxPrice}
                      onSetAmenities={setAmenities}
                      onSetPriceRange={setPriceRange}
                    />
                  </div>
                </SheetContent>
              </Sheet>
            ) : (
              <FilterBottomSheet
                currentFilters={asFilterState}
                onApply={(d) => {
                  setAmenities(d.amenities);
                  setPriceRange(d.minPrice, d.maxPrice);
                }}
                mode="all"
                trigger={
                  <button
                    type="button"
                    className="shrink-0 inline-flex items-center gap-1.5 rounded-full px-4 py-2 text-sm font-semibold transition-all duration-200 cursor-pointer bg-emerald-500 text-white shadow-sm shadow-emerald-200 hover:bg-emerald-600"
                  >
                    <SlidersHorizontal className="h-3.5 w-3.5" />
                    Filters
                    {activeFilterCount > 0 && (
                      <span className="ml-0.5 inline-flex h-5 min-w-[20px] items-center justify-center rounded-full bg-white/20 px-1.5 text-xs font-bold leading-none">
                        {activeFilterCount}
                      </span>
                    )}
                  </button>
                }
              />
            )}

            <FilterBottomSheet
              currentFilters={asFilterState}
              mode="price"
              onApply={(d) => setPriceRange(d.minPrice, d.maxPrice)}
              trigger={
                <button
                  type="button"
                  className="shrink-0 inline-flex items-center gap-1.5 rounded-full px-4 py-2 text-sm font-semibold transition-all duration-200 cursor-pointer bg-rose-500 text-white shadow-sm shadow-rose-200 hover:bg-rose-600"
                >
                  <Tag className="h-3.5 w-3.5" />
                  Price
                  {(minPrice || maxPrice) && (
                    <span className="ml-0.5 inline-flex h-5 min-w-[20px] items-center justify-center rounded-full bg-white/20 px-1.5 text-xs font-bold leading-none">
                      1
                    </span>
                  )}
                </button>
              }
            />
          </div>
        </div>

        {/* Active filter chips */}
        {(amenities.length > 0 ||
          minPrice ||
          maxPrice ||
          locations.length > 0) && (
          <div className="flex flex-wrap gap-2 mb-4">
            {amenities.map((a) => (
              <span
                key={a}
                className="inline-flex items-center gap-1 rounded-full bg-emerald-50 border border-emerald-200/70 pl-3 pr-1.5 py-1 text-xs font-bold text-emerald-700"
              >
                {a}
                <button
                  type="button"
                  onClick={() => setAmenities(amenities.filter((x) => x !== a))}
                  className="text-emerald-600 hover:text-emerald-800 rounded-full p-0.5 hover:bg-emerald-100 cursor-pointer"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </span>
            ))}
            {(minPrice || maxPrice) && (
              <span className="inline-flex items-center gap-1 rounded-full bg-rose-50 border border-rose-200/70 pl-3 pr-1.5 py-1 text-xs font-bold text-rose-700">
                {minPrice ? `KES ${minPrice.toLocaleString()}` : 'Any'} –{' '}
                {maxPrice ? `KES ${maxPrice.toLocaleString()}` : 'Any'}
                <button
                  type="button"
                  onClick={() => setPriceRange(null, null)}
                  className="text-rose-600 hover:text-rose-800 rounded-full p-0.5 hover:bg-rose-100 cursor-pointer"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </span>
            )}
          </div>
        )}

        {/* Results count */}
        <div className="mb-5 mt-1 px-1">
          <p className="text-sm text-slate-400 font-semibold">
            {filtered.length} {filtered.length === 1 ? 'stay' : 'stays'} found
            {hasAnyFilters && (
              <span className="text-slate-300">
                {' '}
                ·{' '}
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
        </div>

        {/* Listing grid */}
        {filtered.length > 0 ? (
          <>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {visible.map((item) => {
                const sorted = [...(item.images ?? [])].sort(
                  (a, b) => a.display_order - b.display_order,
                );
                const imageUrl =
                  sorted[0]?.r2_url ??
                  'https://images.unsplash.com/photo-1555854877-bab0e564b8d5?q=80&w=600';
                const blurDataUrl = sorted[0]?.blur_data_url;
                const bnb = item.bnb;
                const priceUnit = priceUnitLabel(bnb?.price_unit);
                const listingType = listingTypeLabel(bnb?.listing_type);

                return (
                  <Link
                    key={item.id}
                    href={`/bnb/${item.id}`}
                    className="group flex flex-col bg-white rounded-2xl overflow-hidden border border-slate-100 md:hover:shadow-lg md:transition-shadow md:duration-200 h-full cursor-pointer"
                  >
                    <div className="relative aspect-[4/3] overflow-hidden bg-slate-100">
                      <Image
                        src={imageUrl}
                        alt={item.title}
                        fill
                        className="object-cover md:transition-transform md:duration-500 md:group-hover:scale-105"
                        sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
                        placeholder="blur"
                        blurDataURL={blurDataUrl || FALLBACK_BLUR}
                      />
                      <div className="absolute top-3 left-3 bg-white/95 px-2.5 py-1 rounded-full text-[10px] font-semibold tracking-wide text-slate-800 shadow-sm ring-1 ring-slate-900/5">
                        {listingType}
                      </div>
                      {item.verified && (
                        <div className="absolute bottom-2.5 left-2.5 inline-flex items-center gap-1 rounded-full bg-emerald-600 px-2 py-1 text-[10px] font-bold text-white shadow-sm">
                          <BadgeCheck className="h-3 w-3" /> Verified
                        </div>
                      )}
                      <div
                        className="absolute right-2 top-2"
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                        }}
                      >
                        <SaveButton
                          listingId={String(item.id)}
                          variant="icon"
                          className="h-8 w-8 border-white/60 shadow-sm"
                        />
                      </div>
                    </div>

                    <div className="p-4 flex-1 flex flex-col">
                      <h3 className="font-bold text-slate-900 line-clamp-1 group-hover:text-emerald-600 transition-colors text-[14px]">
                        {item.title}
                      </h3>

                      <div className="flex items-center gap-1 text-slate-500 text-xs font-semibold mt-1 truncate">
                        <MapPin className="h-3 w-3 shrink-0" />
                        <span className="truncate">
                          {item.area || item.location}
                        </span>
                      </div>

                      {bnb &&
                        (bnb.max_guests ||
                          bnb.bedrooms != null ||
                          bnb.bathrooms != null) && (
                          <div className="flex items-center gap-3 mt-2 text-xs text-slate-500">
                            {bnb.max_guests && (
                              <span className="flex items-center gap-1">
                                <Users className="h-3 w-3" />
                                {bnb.max_guests} guest
                                {bnb.max_guests !== 1 ? 's' : ''}
                              </span>
                            )}
                            {bnb.bedrooms != null && (
                              <span className="flex items-center gap-1">
                                <BedDouble className="h-3 w-3" />
                                {bnb.bedrooms} bed
                                {bnb.bedrooms !== 1 ? 's' : ''}
                              </span>
                            )}
                            {bnb.bathrooms != null && (
                              <span className="flex items-center gap-1">
                                <Bath className="h-3 w-3" />
                                {bnb.bathrooms} bath
                                {bnb.bathrooms !== 1 ? 's' : ''}
                              </span>
                            )}
                          </div>
                        )}

                      <div className="mt-auto pt-3 border-t border-slate-100 mt-3">
                        <p className="text-sm font-bold text-slate-900">
                          {formatCurrency(item.price)}
                          <span className="ml-1 text-xs font-medium text-slate-500">
                            {priceUnit}
                          </span>
                        </p>
                      </div>
                    </div>
                  </Link>
                );
              })}
            </div>

            {displayLimit < filtered.length && (
              <div ref={loadMoreRef} className="py-8 flex justify-center">
                <button
                  type="button"
                  onClick={() =>
                    setDisplayState((prev) => {
                      const cur = prev.key === filterKey ? prev.limit : INITIAL;
                      return {
                        key: filterKey,
                        limit: Math.min(cur + BATCH, filtered.length),
                      };
                    })
                  }
                  className="inline-flex items-center justify-center px-6 py-2.5 rounded-full border border-slate-200 bg-white text-xs font-bold text-slate-700 hover:bg-slate-50 transition-colors shadow-xs touch-manipulation cursor-pointer"
                >
                  Show more ({filtered.length - displayLimit} remaining)
                </button>
              </div>
            )}
          </>
        ) : (
          <div className="border border-slate-100 bg-white px-6 py-20 text-center sm:px-12">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-emerald-50 text-emerald-700">
              <MapPin className="h-6 w-6" />
            </div>
            <h2 className="mt-5 text-xl font-bold tracking-tight text-slate-950">
              {allListings.length === 0
                ? 'RumiaBnB stays are coming soon'
                : 'No stays found'}
            </h2>
            <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-slate-500">
              {allListings.length === 0
                ? 'Published short-stay properties will appear here as they become available.'
                : 'Try a different location or clear your filters to see more of RumiaBnB.'}
            </p>
            {allListings.length > 0 && hasAnyFilters && (
              <button
                type="button"
                onClick={handleClearAll}
                className="mt-6 inline-flex items-center rounded-xl bg-slate-950 px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-slate-800"
              >
                Clear all filters
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
