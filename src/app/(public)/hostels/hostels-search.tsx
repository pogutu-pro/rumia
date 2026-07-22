'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import { Search, MapPin, Eye, X, SlidersHorizontal, GitCompareArrows, Check, Tag, Info, CalendarCheck } from 'lucide-react';
import { toast } from 'sonner';
import { Input } from '@/components/ui/input';
import { useDebounce } from '@/hooks/use-debounce';
import { useMediaQuery } from '@/hooks/use-media-query';
import { getDistanceBadgeText } from '@/lib/constants/dekut-areas';
import { EarlyAccessBanner } from '@/components/feedback/early-access-banner';
import { useFilterStore, type FilterState } from '@/stores/filter-store';
import { useCompareStore } from '@/stores/compare-store';
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
import { parseQuery } from '@/lib/search/parse-query';
import {
  cascadeSearch,
  fetchListings,
  type CombinedFilters,
  type CascadeTier,
  type SearchListing,
} from '@/lib/search/cascade-search';

export type Listing = SearchListing;

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
  totalCount: number;
  pageSize: number;
}

export default function HostelsSearch({ initialListings, totalCount, pageSize }: HostelsSearchProps) {
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
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(initialListings.length >= pageSize);
  const [offset, setOffset] = useState(initialListings.length);
  const [totalCountState, setTotalCount] = useState(totalCount);
  const [desktopFilterOpen, setDesktopFilterOpen] = useState(false);
  const [tier, setTier] = useState<CascadeTier>(1);
  const [originalFreeText, setOriginalFreeText] = useState('');
  const searchIdRef = useRef(0);
  const effectiveFiltersRef = useRef<CombinedFilters | null>(null);

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
    maxDistance,
    sortByNearest,
    setMaxDistance,
    setSortByNearest,
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

  // Hydrate compare selections from localStorage
  const hydrateCompare = useCompareStore((s) => s.hydrateFromStorage);
  useEffect(() => {
    hydrateCompare();
  }, [hydrateCompare]);

  const compareSelectedIds = useCompareStore((s) => s.selectedIds);
  const addCompareSelection = useCompareStore((s) => s.addSelection);
  const removeCompareSelection = useCompareStore((s) => s.removeSelection);
  const isCompareSelected = useCompareStore((s) => s.isSelected);

  const handleCompareToggle = useCallback(
    (item: Listing) => {
      const sorted = [...(item.listing_images || [])].sort(
        (a, b) => a.display_order - b.display_order,
      );
      const imageUrl = sorted[0]?.r2_url;
      const roomTypes = item.listing_room_types || [];
      const firstRoom = roomTypes[0] || {};

      if (isCompareSelected(item.id)) {
        removeCompareSelection(item.id);
        toast.info(`${item.title} removed from comparison`);
        return;
      }

      const result = addCompareSelection({
        id: item.id,
        title: item.title,
        price: item.price,
        price_single: item.price_single,
        price_sharing: item.price_sharing,
        imageUrl,
        slug: item.slug,
        county: item.county,
        area: item.area,
        agentName: item.agents?.name ?? null,
        agentPhone: item.agents?.phone ?? null,
        agentWhatsapp: item.agents?.whatsapp ?? null,
        amenities: item.amenities,
        roomType: item.room_type,
        roomTypeEnum: item.room_type_enum,
        bathroomType: item.bathroom_type,
        distanceCategory: item.distance_category,
        distanceToCampus: item.distance_to_campus,
        gender: item.gender,
        wifiIncluded: item.wifi_included,
        waterIncluded: item.water_included,
        electricityIncluded: item.electricity_included,
        securityType: item.security_type,
        specificLocation: item.specific_location,
        latitude: item.latitude,
        longitude: item.longitude,
        mpesaDetails: item.mpesa_details,
        deposit: firstRoom.deposit ?? null,
        furnishingItems: firstRoom.furnishing_items ?? null,
        roomTypeLabel: firstRoom.room_type ?? null,
      });

      if (result.ok) {
        const currentCount = compareSelectedIds.length + 1;
        if (currentCount === 1) {
          toast.success(`${item.title} added to comparison`, {
            description: 'Select one more hostel to start comparing.',
          });
        } else {
          toast.success(`${item.title} added to comparison`);
        }
      } else if (result.reason === 'max_reached') {
        toast.error('Maximum hostels reached', {
          description: 'Remove a hostel first before adding another.',
        });
      }
    },
    [addCompareSelection, removeCompareSelection, isCompareSelected, compareSelectedIds.length],
  );

  const filters: FilterState = {
    genders,
    amenities,
    roomTypes,
    minPrice,
    maxPrice,
    zones,
    maxDistance,
    sortByNearest,
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
      const thisSearch = ++searchIdRef.current;
      setLoading(true);
      setOffset(0);
      setHasMore(true);
      const combined = buildCombinedFilters(searchText);
      const result = await cascadeSearch(combined, pageSize);
      if (thisSearch !== searchIdRef.current) return;
      setListings(result.listings);
      setTotalCount(result.count);
      setOffset(result.listings.length);
      setHasMore(result.listings.length < result.count);
      setTier(result.tier);
      setOriginalFreeText(result.originalFreeText);
      effectiveFiltersRef.current = result.effectiveFilters;
      setLoading(false);
    },
    [buildCombinedFilters, pageSize],
  );

  const loadMore = useCallback(async () => {
    if (loadingMore || !hasMore) return;
    const filters = effectiveFiltersRef.current;
    if (!filters) return;
    setLoadingMore(true);
    const result = await fetchListings(filters, offset, offset + pageSize - 1);
    setListings((prev) => [...prev, ...result.listings]);
    setOffset((prev) => prev + result.listings.length);
    setHasMore(offset + result.listings.length < result.count);
    setLoadingMore(false);
  }, [loadingMore, hasMore, offset, pageSize]);

  // URL sync
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
  }, [debouncedQuery, genders, amenities, roomTypes, minPrice, maxPrice, zones, router, toParams]);

  // Search execution
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    runSearch(debouncedQuery);
  }, [debouncedQuery, genders, amenities, roomTypes, minPrice, maxPrice, zones, runSearch]);

  const handleClearAll = useCallback(() => {
    reset();
    setQuery('');
    setTier(1);
    setOriginalFreeText('');
    effectiveFiltersRef.current = null;
  }, [reset]);

  const handleMobileApply = useCallback(
    (draft: FilterState) => {
      setGenders(draft.genders);
      setAmenities(draft.amenities);
      setRoomTypes(draft.roomTypes);
      setPriceRange(draft.minPrice, draft.maxPrice);
      setZones(draft.zones);
      setMaxDistance(draft.maxDistance);
      setSortByNearest(draft.sortByNearest);
    },
    [
      setGenders,
      setAmenities,
      setRoomTypes,
      setPriceRange,
      setZones,
      setMaxDistance,
      setSortByNearest,
    ],
  );

  const activeFilterCount =
    genders.length +
    amenities.length +
    roomTypes.length +
    (minPrice || maxPrice ? 1 : 0) +
    zones.length;

  const priceFilterActive = minPrice || maxPrice ? 1 : 0;
  const distanceFilterActive = maxDistance || sortByNearest ? 1 : 0;

  const parsedSmart = parseQuery(debouncedQuery);
  const hasSmartFilters =
    !!parsedSmart.freeText ||
    !!parsedSmart.maxPrice ||
    !!parsedSmart.minPrice ||
    !!parsedSmart.exactPrice ||
    !!parsedSmart.gender ||
    !!parsedSmart.roomType ||
    !!parsedSmart.area ||
    parsedSmart.amenities.length > 0;
  const hasAnyFilters = activeFilterCount > 0 || hasSmartFilters;

  return (
    <div className="min-h-screen bg-slate-50/50 py-6 lg:py-10">
      <div className="mx-auto max-w-6xl px-4 lg:px-8">
        {/* Header */}
        <div className="mb-5">
          <h1 className="text-2xl lg:text-3xl font-black text-slate-900 tracking-tight">
            Student Hostels Near DeKUT
          </h1>
          <p className="text-slate-500 font-medium mt-1 text-sm lg:text-base">
            Search by name, location, price, or amenities — handles typos too.
          </p>
        </div>

        {/* Search Input */}
        <div className="relative mb-3">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-400 pointer-events-none" />
          <Input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder='e.g. "cheap ladies wifi gate A" or "Sunshine Hostels" or "5k self contained"'
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

        {/* Filter toolbar */}
        <div className="mb-5 space-y-3">
          <div className="flex flex-nowrap items-center gap-3 overflow-x-auto scrollbar-none">
            {/* Filters — advanced filtering (leave as is) */}
            {isDesktop ? (
              <Sheet
                open={desktopFilterOpen}
                onOpenChange={setDesktopFilterOpen}
              >
                <SheetTrigger asChild>
                  <button
                    type="button"
                    className="shrink-0 inline-flex items-center gap-2 rounded-full px-5 py-2.5 text-sm font-semibold transition-all duration-200 cursor-pointer bg-emerald-500 text-white shadow-sm shadow-emerald-200 hover:bg-emerald-600"
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
                      onSetMaxDistance={setMaxDistance}
                      onSetSortByNearest={setSortByNearest}
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

            {/* Price — coral/red-pink, the most-used quick filter */}
            <FilterBottomSheet
              currentFilters={filters}
              mode="price"
              onApply={(d) => setPriceRange(d.minPrice, d.maxPrice)}
              trigger={
                <button
                  type="button"
                  className="shrink-0 inline-flex items-center gap-2 rounded-full px-5 py-2.5 text-sm font-semibold transition-all duration-200 cursor-pointer bg-rose-500 text-white shadow-sm shadow-rose-200 hover:bg-rose-600"
                >
                  <Tag className="h-4 w-4" />
                  Price
                  {priceFilterActive > 0 && (
                    <span className="inline-flex h-5 min-w-[20px] items-center justify-center rounded-full bg-white/20 px-1.5 text-xs font-bold">
                      {priceFilterActive}
                    </span>
                  )}
                </button>
              }
            />

            {/* Distance — blue, associated with location */}
            <FilterBottomSheet
              currentFilters={filters}
              mode="distance"
              onApply={(d) => {
                setMaxDistance(d.maxDistance);
                setSortByNearest(d.sortByNearest);
              }}
              trigger={
                <button
                  type="button"
                  className="shrink-0 inline-flex items-center gap-2 rounded-full px-5 py-2.5 text-sm font-semibold transition-all duration-200 cursor-pointer bg-blue-500 text-white shadow-sm shadow-blue-200 hover:bg-blue-600"
                >
                  <MapPin className="h-4 w-4" />
                  Distance
                  {distanceFilterActive > 0 && (
                    <span className="inline-flex h-5 min-w-[20px] items-center justify-center rounded-full bg-white/20 px-1.5 text-xs font-bold">
                      {distanceFilterActive}
                    </span>
                  )}
                </button>
              }
            />

            {isDesktop && (
              <p className="text-sm text-slate-400 font-semibold">
                {loading ? (
                  <span className="text-slate-300">Searching...</span>
                ) : (
                  <>
                    {totalCountState}{' '}
                    {totalCountState === 1 ? 'hostel' : 'hostels'} found
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
            onRemoveMaxDistance={() => setMaxDistance(null)}
            onRemoveSortByNearest={() => setSortByNearest(false)}
            onClearAll={handleClearAll}
          />
        </div>

        {/* Cascade tier indicator — shows when results are relaxed */}
        {!loading && tier !== 1 && query && (
          <div
            className={`mb-4 flex items-start gap-3 p-3.5 rounded-xl text-sm font-medium border ${
              tier === 1.1
                ? 'bg-indigo-50 border-indigo-100 text-indigo-700'
                : tier === 1.2
                  ? 'bg-violet-50 border-violet-100 text-violet-700'
                  : tier === 2
                    ? 'bg-blue-50 border-blue-100 text-blue-700'
                    : 'bg-amber-50 border-amber-100 text-amber-700'
            }`}
          >
            <Info className="h-4 w-4 mt-0.5 shrink-0" />
            <p className="flex-1">
              {tier === 1.1 ? (
                <>
                  Showing results matching individual words from <span className="font-bold">&quot;{originalFreeText}&quot;</span> —
                  no exact phrase match found.
                </>
              ) : tier === 1.2 ? (
                <>
                  Showing similar results for <span className="font-bold">&quot;{originalFreeText}&quot;</span> —
                  we found close matches even with possible typos.
                </>
              ) : tier === 2 ? (
                <>
                  Showing results without <span className="font-bold">&quot;{originalFreeText}&quot;</span> — we
                  broadened the search to show more options.
                </>
              ) : (
                <>
                  Showing all hostels — your search didn&apos;t match specific listings. Try
                  simpler terms like <span className="font-bold">&quot;wifi&quot;</span>,{' '}
                  <span className="font-bold">&quot;ladies&quot;</span>, or a price like{' '}
                  <span className="font-bold">&quot;5000&quot;</span>.
                </>
              )}
            </p>
            <button
              type="button"
              onClick={handleClearAll}
              className={`shrink-0 text-xs font-bold underline underline-offset-2 hover:no-underline cursor-pointer ${
                tier === 1.1
                  ? 'text-indigo-600'
                  : tier === 1.2
                    ? 'text-violet-600'
                    : tier === 2
                      ? 'text-blue-600'
                      : 'text-amber-600'
              }`}
            >
              Refine
            </button>
          </div>
        )}

        {/* Mobile results count */}
        {!isDesktop && !loading && (
          <p className="text-sm text-slate-400 font-semibold mb-5 px-1">
            {totalCountState}{' '}
            {totalCountState === 1 ? 'hostel' : 'hostels'} found
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

        {/* Book a Tour CTA */}
        {!loading && (
          <div className="mb-6 bg-white border border-slate-100 rounded-2xl p-5 flex flex-col sm:flex-row items-start sm:items-center gap-4">
            <div className="flex items-center gap-3 flex-1 min-w-0">
              <div className="w-10 h-10 rounded-xl bg-slate-900 flex items-center justify-center shrink-0">
                <CalendarCheck className="h-5 w-5 text-white" />
              </div>
              <div className="min-w-0">
                <p className="text-sm font-bold text-slate-900">
                  Not sure which one to pick?
                </p>
                <p className="text-xs text-slate-500 mt-0.5">
                  Book a guided tour and let a verified agent show you the best options in person.
                </p>
              </div>
            </div>
            <Link
              href="/book-tour"
              className="shrink-0 inline-flex items-center gap-2 h-10 px-5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-sm font-bold transition-colors"
            >
              <CalendarCheck className="h-4 w-4" />
              Book a Tour
            </Link>
          </div>
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
              const blurDataUrl = sorted[0]?.blur_data_url;
              const href = item.slug
                ? `/hostels/${item.county ?? 'nyeri'}/${item.area ?? 'dekut'}/${item.slug}`
                : `/listing/${item.id}`;

              const distanceBadge = getDistanceBadgeText(
                item.distance_category,
              );
              const isSelected = isCompareSelected(item.id);

              let priceDisplay = `KES ${item.price.toLocaleString()}/mo`;
              if (item.price_single && item.price_sharing) {
                priceDisplay = `KES ${item.price_single.toLocaleString()} for 1 person · KES ${item.price_sharing.toLocaleString()} sharing`;
              } else if (item.price_single) {
                priceDisplay = `KES ${item.price_single.toLocaleString()}/mo for 1 person`;
              } else if (item.price_sharing) {
                priceDisplay = `KES ${item.price_sharing.toLocaleString()}/mo sharing`;
              }

              let areaDisplay = item.area || 'Hostel Area';
              if (item.specific_location) {
                areaDisplay = `${areaDisplay} · ${item.specific_location}`;
              }

              return (
                <div key={item.id} className="relative group/card">
                  <Link
                    href={href}
                    className={`group flex flex-col bg-white rounded-2xl overflow-hidden hover:shadow-lg transition-all duration-300 h-full cursor-pointer ${
                      isSelected
                        ? 'border-2 border-emerald-400 shadow-md shadow-emerald-100'
                        : 'border border-slate-100'
                    }`}
                  >
                    <div className="relative aspect-4/3 overflow-hidden bg-slate-100">
                      <Image
                        src={imageUrl}
                        alt={`${item.title} — student hostel near DeKUT`}
                        fill
                        className="object-cover transition-transform duration-500 group-hover:scale-105"
                        sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
                        placeholder={blurDataUrl ? 'blur' : undefined}
                        blurDataURL={blurDataUrl || undefined}
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
                        <div className="flex items-center gap-2">
                          {/* Compare button — inline next to View */}
                          <button
                            type="button"
                            onClick={(e) => {
                              e.preventDefault();
                              e.stopPropagation();
                              handleCompareToggle(item);
                            }}
                            className="inline-flex items-center gap-1 rounded-lg bg-slate-900 px-2.5 py-1 text-[11px] font-bold text-white transition-all duration-200 cursor-pointer hover:bg-slate-700"
                          >
                            {isSelected ? (
                              <>
                                <Check className="h-3 w-3" />
                                Added
                              </>
                            ) : (
                              <>
                                <GitCompareArrows className="h-3 w-3" />
                                Compare
                              </>
                            )}
                          </button>
                          <span className="font-semibold text-emerald-600 group-hover:underline flex items-center gap-0.5 cursor-pointer">
                            <Eye className="h-3.5 w-3.5" /> View Details
                          </span>
                        </div>
                      </div>
                    </div>
                  </Link>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="text-center py-24 bg-white border border-slate-100 rounded-2xl">
            <p className="text-slate-500 font-semibold text-sm max-w-sm mx-auto">
              Something went wrong. Try refreshing or clearing your search.
            </p>
            <button
              type="button"
              onClick={handleClearAll}
              className="mt-5 inline-flex items-center px-5 py-2.5 bg-slate-900 text-white rounded-xl text-sm font-semibold hover:bg-slate-800 transition-colors cursor-pointer"
            >
              Clear all filters
            </button>
          </div>
        )}

        {/* Load More */}
        {!loading && hasMore && listings.length > 0 && (
          <div className="mt-8 text-center">
            <button
              type="button"
              onClick={loadMore}
              disabled={loadingMore}
              className="inline-flex items-center gap-2 px-8 py-3.5 bg-emerald-600 text-white rounded-xl text-sm font-bold shadow-md shadow-emerald-600/10 hover:bg-emerald-500 active:scale-[0.98] transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loadingMore ? (
                <>
                  <span className="h-4 w-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Loading...
                </>
              ) : (
                'Load more hostels'
              )}
            </button>
          </div>
        )}

        <div className="mt-8">
          <EarlyAccessBanner />
        </div>
      </div>
    </div>
  );
}
