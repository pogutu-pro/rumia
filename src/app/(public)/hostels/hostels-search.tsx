'use client';

import { useEffect, useState, useCallback, useRef, useMemo } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import { Search, MapPin, Eye, X, SlidersHorizontal, GitCompareArrows, Check, Tag, CalendarCheck } from 'lucide-react';
import { toast } from 'sonner';
import { Input } from '@/components/ui/input';
import { useDebounce } from '@/hooks/use-debounce';
import { createClient } from '@/lib/supabase/client';
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
import { clientSearch } from '@/lib/search/client-search';
import type { SearchListing, CombinedFilters } from '@/lib/search/cascade-search';

export type Listing = SearchListing;

// Generic soft placeholder for listings that have no blur_data_url — prevents
// the grey flash when a card mounts before its image finishes loading.
const FALLBACK_BLUR =
  'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCA2MDAgNDUwIj48cmVjdCB3aWR0aD0iNjAwIiBoZWlnaHQ9IjQ1MCIgZmlsbD0iI2UyZThmMCIvPjwvc3ZnPg==';

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
  allListings: Listing[];
  hideHeader?: boolean;
  basePath?: string;
}

export default function HostelsSearch({
  allListings,
  hideHeader = false,
  basePath = '/hostels',
}: HostelsSearchProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const isDesktop = useMediaQuery('(min-width: 1024px)');
  const hydrationDone = useRef(false);

  const initialQuery = searchParams.get('q') ?? '';
  const [query, setQuery] = useState(initialQuery);
  const debouncedQuery = useDebounce(query, 200);
  // URL sync is deferred to explicit commits so typing never triggers a
  // router navigation per keystroke.
  const [committedQuery, setCommittedQuery] = useState(initialQuery);
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
    maxDistance,
    sortByNearest,
    setMaxDistance,
    setSortByNearest,
    reset,
    hydrateFromParams,
    toParams,
  } = useFilterStore();

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

  const [isLoggedIn, setIsLoggedIn] = useState(false);

  useEffect(() => {
    let active = true;
    async function checkAuth() {
      const { data: { user } } = await createClient().auth.getUser();
      if (active && user) setIsLoggedIn(true);
    }
    void checkAuth();
    return () => { active = false; };
  }, []);

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

  // ── Client-side search ─────────────────────────────────────────────────────

  const combinedFilters = useMemo<CombinedFilters>(
    () => ({
      searchText: debouncedQuery,
      genders,
      amenities,
      roomTypes,
      minPrice,
      maxPrice,
      zones,
    }),
    [debouncedQuery, genders, amenities, roomTypes, minPrice, maxPrice, zones],
  );

  // Client-side search — fully synchronous, derived via useMemo
  const allFiltered = useMemo(
    () => clientSearch(allListings, combinedFilters, allListings.length, 0).listings,
    [allListings, combinedFilters],
  );

  const totalCountState = allFiltered.length;

  // ── URL sync ───────────────────────────────────────────────────────────────
  // Runs on filter changes and committed queries (Enter / blur / clear) so the
  // search box never triggers a navigation while the user is still typing.

  useEffect(() => {
    const filterParams = toParams();
    const qParam = committedQuery
      ? `q=${encodeURIComponent(committedQuery)}`
      : '';
    const filterStr = filterParams.toString();
    const url =
      qParam || filterStr
        ? `${basePath}?${[qParam, filterStr].filter(Boolean).join('&')}`
        : basePath;
    router.replace(url, { scroll: false });
  }, [committedQuery, genders, amenities, roomTypes, minPrice, maxPrice, zones, basePath, router, toParams]);

  const handleClearAll = useCallback(() => {
    reset();
    setQuery('');
    setCommittedQuery('');
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

  const hasAnyFilters = activeFilterCount > 0 || debouncedQuery.length > 0;

  return (
    <div className="min-h-screen bg-slate-50/50 pt-4 pb-8 lg:pt-6 lg:pb-10">
      <div className="mx-auto max-w-6xl px-4 lg:px-8">
        {/* Search Input */}
        <div className="relative mb-3">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-400 pointer-events-none" />
          <Input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') setCommittedQuery(query);
            }}
            onBlur={() => setCommittedQuery(query)}
            placeholder="Search by hostel name, area, or price"
            className="pl-12 h-13 text-base bg-white border-slate-200 focus-visible:ring-emerald-500 rounded-2xl shadow-sm"
          />
          {query && (
            <button
              type="button"
              onClick={() => {
                setQuery('');
                setCommittedQuery('');
              }}
              className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700 transition-colors cursor-pointer"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>

        {/* Filter toolbar */}
        <div className="mb-3 space-y-3">
          <div className="flex flex-nowrap items-center gap-3 overflow-x-auto scrollbar-none">
            {isDesktop ? (
              <Sheet
                open={desktopFilterOpen}
                onOpenChange={setDesktopFilterOpen}
              >
                <SheetTrigger asChild>
                  <button
                    type="button"
                    className="shrink-0 inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-semibold transition-all duration-200 cursor-pointer bg-emerald-500 text-white shadow-sm shadow-emerald-200 hover:bg-emerald-600"
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
                      filters={{
                        genders,
                        amenities,
                        roomTypes,
                        minPrice,
                        maxPrice,
                        zones,
                        maxDistance,
                        sortByNearest,
                      }}
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
                currentFilters={{
                  genders,
                  amenities,
                  roomTypes,
                  minPrice,
                  maxPrice,
                  zones,
                  maxDistance,
                  sortByNearest,
                }}
                onApply={handleMobileApply}
              />
            )}

            <FilterBottomSheet
              currentFilters={{
                genders,
                amenities,
                roomTypes,
                minPrice,
                maxPrice,
                zones,
                maxDistance,
                sortByNearest,
              }}
              mode="price"
              onApply={(d) => setPriceRange(d.minPrice, d.maxPrice)}
              trigger={
                <button
                  type="button"
                  className="shrink-0 inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-semibold transition-all duration-200 cursor-pointer bg-rose-500 text-white shadow-sm shadow-rose-200 hover:bg-rose-600"
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

            <Link
              href={isLoggedIn ? '/account/book-tour' : '/book-tour'}
              className="shrink-0 inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-semibold bg-slate-900 text-white hover:bg-slate-800 transition-colors cursor-pointer"
            >
              <CalendarCheck className="h-4 w-4" />
              Book a Tour
            </Link>
          </div>

          <ActiveFilterChips
            filters={{
              genders,
              amenities,
              roomTypes,
              minPrice,
              maxPrice,
              zones,
              maxDistance,
              sortByNearest,
            }}
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

        {/* Results count */}
        <div className="mb-5 px-1">
          <p className="text-sm text-slate-400 font-semibold">
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
        </div>

        {/* Listing Grid — all listings render in HTML for crawlers */}
        {allFiltered.length > 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {allFiltered.map((item) => {
              const sorted = [...(item.listing_images || [])].sort(
                (a, b) => a.display_order - b.display_order,
              );
              const imageUrl =
                sorted[0]?.r2_url ??
                'https://images.unsplash.com/photo-1555854877-bab0e564b8d5?q=80&w=600';
              const blurDataUrl = sorted[0]?.blur_data_url;              const href = item.slug
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
                <div
                  key={item.id}
                  className="relative group/card"
                >
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
                        placeholder="blur"
                        blurDataURL={blurDataUrl || FALLBACK_BLUR}
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
                           <button
                             type="button"
                             onClick={(e) => {
                               e.preventDefault();
                               e.stopPropagation();
                               handleCompareToggle(item);
                             }}
                             className={`inline-flex items-center gap-2 rounded-full px-5 py-2.5 text-sm font-bold transition-all duration-200 cursor-pointer border-2 ${
                               isSelected
                                 ? 'bg-emerald-600 text-white border-emerald-600 shadow-lg shadow-emerald-600/20'
                                 : 'bg-white text-slate-900 border-slate-900 hover:bg-slate-900 hover:text-white shadow-sm'
                             }`}
                           >
                             {isSelected ? (
                               <>
                                 <Check className="h-4 w-4" />
                                 Added
                               </>
                             ) : (
                               <>
                                 <GitCompareArrows className="h-4 w-4" />
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
              No hostels match your search. Try different terms or clear your filters.
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

        <div className="mt-8">
          <EarlyAccessBanner hostelCount={allListings.length} />
        </div>
      </div>
    </div>
  );
}
