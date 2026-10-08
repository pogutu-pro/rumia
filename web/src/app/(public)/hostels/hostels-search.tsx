'use client';

import { useEffect, useState, useCallback, useRef, useMemo } from 'react';
import { getStartingPrice } from '@/lib/utils/starting-price';
import { NoPhotoTile } from '@/components/ui/no-photo-tile';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import {
  MapPin,
  Eye,
  X,
  GitCompareArrows,
  Check,
} from 'lucide-react';
import { toast } from 'sonner';
import { createClient } from '@/lib/supabase/client';
import { useMediaQuery } from '@/hooks/use-media-query';
import { getDistanceBadgeText } from '@/lib/constants/dekut-areas';
import { EarlyAccessBanner } from '@/components/feedback/early-access-banner';
import { useFilterStore, type FilterState } from '@/stores/filter-store';
import { useCompareStore } from '@/stores/compare-store';
import { ActiveFilterChips } from '@/components/ui/filter/active-filter-chips';
import { clientSearch } from '@/lib/search/client-search';
import type {
  SearchListing,
  CombinedFilters,
} from '@/lib/search/types';

export type Listing = SearchListing;

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

  // The search query is now driven entirely by the navbar — we read it from the
  // URL param and use it directly for client-side filtering.
  const qParamFromUrl = searchParams.get('q') ?? '';

  // Optional category pre-filter from Home Explore "See all" links (?type=).
  const propertyType = searchParams.get('type');

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
      const {
        data: { user },
      } = await createClient().auth.getUser();
      if (active && user) setIsLoggedIn(true);
    }
    void checkAuth();
    return () => {
      active = false;
    };
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
    [
      addCompareSelection,
      removeCompareSelection,
      isCompareSelected,
      compareSelectedIds.length,
    ],
  );

  // ── Client-side search ─────────────────────────────────────────────────────
  // searchText is now driven by the URL param (navbar updates it via router.replace)

  const combinedFilters = useMemo<CombinedFilters>(
    () => ({
      searchText: qParamFromUrl,
      genders,
      amenities,
      roomTypes,
      minPrice,
      maxPrice,
      zones,
    }),
    [qParamFromUrl, genders, amenities, roomTypes, minPrice, maxPrice, zones],
  );

  const allFiltered = useMemo(
    () =>
      clientSearch(allListings, combinedFilters, allListings.length, 0)
        .listings,
    [allListings, combinedFilters],
  );

  const typedListings = useMemo(() => {
    if (!propertyType) return allFiltered;
    return allFiltered.filter(
      (l) => (l.property_type ?? 'hostel') === propertyType,
    );
  }, [allFiltered, propertyType]);

  const totalCountState = typedListings.length;

  // ── Progressive rendering for mobile performance ──────────────────────────
  const INITIAL_DISPLAY_COUNT = 12;
  const BATCH_SIZE = 12;
  const displayFilterKey = JSON.stringify([
    qParamFromUrl,
    genders,
    amenities,
    roomTypes,
    minPrice,
    maxPrice,
    zones,
    propertyType,
  ]);
  const [displayState, setDisplayState] = useState({
    key: '',
    limit: INITIAL_DISPLAY_COUNT,
  });
  const displayLimit =
    displayState.key === displayFilterKey
      ? displayState.limit
      : INITIAL_DISPLAY_COUNT;
  const loadMoreRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (displayLimit >= typedListings.length) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) {
          setDisplayState((prev) => {
            const currentLimit =
              prev.key === displayFilterKey
                ? prev.limit
                : INITIAL_DISPLAY_COUNT;
            return {
              key: displayFilterKey,
              limit: Math.min(currentLimit + BATCH_SIZE, typedListings.length),
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
  }, [displayFilterKey, displayLimit, typedListings.length]);

  const visibleListings = useMemo(() => {
    return typedListings.slice(0, displayLimit);
  }, [typedListings, displayLimit]);

  // ── URL sync (filter changes only — query sync is now owned by the navbar) ──
  useEffect(() => {
    const filterParams = toParams();
    const qParam = qParamFromUrl
      ? `q=${encodeURIComponent(qParamFromUrl)}`
      : '';
    const filterStr = filterParams.toString();
    const url =
      qParam || filterStr
        ? `${basePath}?${[qParam, filterStr].filter(Boolean).join('&')}`
        : basePath;
    router.replace(url, { scroll: false });
  }, [
    qParamFromUrl,
    genders,
    amenities,
    roomTypes,
    minPrice,
    maxPrice,
    zones,
    basePath,
    router,
    toParams,
  ]);

  const handleClearAll = useCallback(() => {
    reset();
    if (propertyType) {
      const rest = new URLSearchParams(searchParams.toString());
      rest.delete('type');
      rest.delete('q');
      router.replace(
        `${basePath}${rest.toString() ? `?${rest.toString()}` : ''}`,
        { scroll: false },
      );
    }
  }, [reset, propertyType, searchParams, basePath, router]);

  const activeFilterCount =
    genders.length +
    amenities.length +
    roomTypes.length +
    (minPrice || maxPrice ? 1 : 0) +
    zones.length;

  const hasAnyFilters = activeFilterCount > 0 || qParamFromUrl.length > 0;

  return (
    <div className="min-h-screen bg-slate-50/50 pt-0 pb-8 lg:pb-10">
      <div className="mx-auto max-w-6xl px-4 lg:px-8">

        {/* Active filter chips — rendered directly, no search card wrapper */}
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
          onRemoveGender={(v) => setGenders(genders.filter((g) => g !== v))}
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

        {/* Results count */}
        <div className="mb-5 mt-3 px-1">
          <p className="text-sm text-slate-400 font-semibold">
            {totalCountState} {totalCountState === 1 ? 'hostel' : 'hostels'}{' '}
            found
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
          {propertyType && (
            <div className="mt-2 inline-flex items-center gap-1.5 rounded-full bg-emerald-50 border border-emerald-200/70 pl-3 pr-1.5 py-1 text-xs font-bold text-emerald-700">
              {propertyType === 'apartment'
                ? 'Apartments'
                : propertyType === 'short_stay'
                  ? 'Short stays'
                  : 'Hostels'}
              <button
                type="button"
                aria-label="Clear category filter"
                onClick={() => {
                  const rest = new URLSearchParams(searchParams.toString());
                  rest.delete('type');
                  router.replace(
                    `${basePath}${rest.toString() ? `?${rest.toString()}` : ''}`,
                    { scroll: false },
                  );
                }}
                className="text-emerald-600 hover:text-emerald-800 rounded-full p-0.5 hover:bg-emerald-100 cursor-pointer"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          )}
        </div>

        {/* Listing Grid */}
        {typedListings.length > 0 ? (
          <>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {visibleListings.map((item) => {
                const sorted = [...(item.listing_images || [])].sort(
                  (a, b) => a.display_order - b.display_order,
                );
                const imageUrl = sorted[0]?.r2_url;
                const blurDataUrl = sorted[0]?.blur_data_url;
                const href = item.slug
                  ? `/hostels/${item.county ?? 'nyeri'}/${item.area ?? 'dekut'}/${item.slug}`
                  : `/listing/${item.id}`;

                const distanceBadge = getDistanceBadgeText(
                  item.distance_category,
                );
                const isSelected = isCompareSelected(item.id);

                const priceDisplay = `From KES ${getStartingPrice(item, item.listing_room_types).toLocaleString()}/mo`;

                let areaDisplay = item.area || 'Hostel Area';
                if (item.specific_location) {
                  areaDisplay = `${areaDisplay} · ${item.specific_location}`;
                }

                return (
                  <div key={item.id} className="relative group/card">
                    <Link
                      href={href}
                      className={`group flex flex-col bg-white rounded-2xl overflow-hidden md:hover:shadow-lg md:transition-shadow md:duration-200 h-full cursor-pointer ${
                        isSelected
                          ? 'border-2 border-emerald-500 shadow-md shadow-emerald-100'
                          : 'border border-slate-100'
                      }`}
                    >
                      <div className="relative aspect-4/3 overflow-hidden bg-slate-100">
                        {imageUrl ? (
                          <Image
                            src={imageUrl}
                            alt={`${item.title} — student hostel near DeKUT`}
                            fill
                            className="object-cover md:transition-transform md:duration-500 md:group-hover:scale-105"
                            sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
                            placeholder="blur"
                            blurDataURL={blurDataUrl || FALLBACK_BLUR}
                          />
                        ) : (
                          <NoPhotoTile />
                        )}

                        {distanceBadge && (
                          <div className="absolute top-3 left-3 bg-slate-900/85 px-2.5 py-1 rounded-full text-xs font-bold shadow-xs text-white">
                            {distanceBadge}
                          </div>
                        )}

                        {item.gender && item.gender !== 'mixed' && (
                          <div
                            className={`absolute top-3 right-3 px-2.5 py-1 rounded-full text-xs font-bold shadow-xs text-white ${
                              item.gender === 'female'
                                ? 'bg-pink-600'
                                : 'bg-blue-600'
                            }`}
                          >
                            {item.gender === 'female'
                              ? 'Ladies Only'
                              : 'Gents Only'}
                          </div>
                        )}

                        {!item.area && (
                          <div className="absolute top-3 right-3 bg-white px-2.5 py-1 rounded-lg text-xs font-bold shadow-xs text-slate-900 border border-slate-100">
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
                          <span>
                            Agent: {item.agents?.name ?? 'Rumia Agent'}
                          </span>
                          <div className="flex items-center gap-2">
                            <button
                              type="button"
                              onClick={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
                                handleCompareToggle(item);
                              }}
                              className={`inline-flex items-center gap-1.5 rounded-full px-4 py-2 text-xs font-bold transition-colors cursor-pointer border-2 touch-manipulation ${
                                isSelected
                                  ? 'bg-emerald-600 text-white border-emerald-600 shadow-sm'
                                  : 'bg-white text-slate-900 border-slate-900 hover:bg-slate-900 hover:text-white shadow-xs'
                              }`}
                            >
                              {isSelected ? (
                                <>
                                  <Check className="h-3.5 w-3.5" />
                                  Added
                                </>
                              ) : (
                                <>
                                  <GitCompareArrows className="h-3.5 w-3.5" />
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

            {/* Infinite scroll sentinel & manual fallback for progressive loading */}
            {displayLimit < typedListings.length && (
              <div
                ref={loadMoreRef}
                className="py-8 flex flex-col items-center justify-center gap-2"
              >
                <button
                  type="button"
                  onClick={() =>
                    setDisplayState((prev) => {
                      const currentLimit =
                        prev.key === displayFilterKey
                          ? prev.limit
                          : INITIAL_DISPLAY_COUNT;
                      return {
                        key: displayFilterKey,
                        limit: Math.min(
                          currentLimit + BATCH_SIZE,
                          typedListings.length,
                        ),
                      };
                    })
                  }
                  className="inline-flex items-center justify-center px-6 py-2.5 rounded-full border border-slate-200 bg-white text-xs font-bold text-slate-700 hover:bg-slate-50 transition-colors shadow-xs touch-manipulation cursor-pointer"
                >
                  Show more ({typedListings.length - displayLimit} remaining)
                </button>
              </div>
            )}
          </>
        ) : (
          <div className="text-center py-24 bg-white border border-slate-100 rounded-2xl">
            <p className="text-slate-500 font-semibold text-sm max-w-sm mx-auto">
              No hostels match your search. Try different terms or clear your
              filters.
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
