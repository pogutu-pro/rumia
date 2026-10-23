'use client';

import { useEffect, useState, useCallback, useRef, useMemo } from 'react';
import Image from 'next/image';
import { useSearchParams } from 'next/navigation';
import { ArrowRight, SlidersHorizontal } from 'lucide-react';
import { toast } from 'sonner';
import { EarlyAccessBanner } from '@/components/feedback/early-access-banner';
import { FilterPanel, type ExploreFilters } from '@/components/explore/filter-panel';
import { ResultCard } from '@/components/explore/result-card';
import { useCampus } from '@/lib/campus-context';
import { BNB_SEPARATE } from '@/lib/site/separation';
import { BNB_ORIGIN } from '@/lib/site/hosts';
import { cn } from '@/lib/utils/cn';
import { useFilterStore, type ExploreSort } from '@/stores/filter-store';
import { useCompareStore } from '@/stores/compare-store';
import { clientSearch } from '@/lib/search/client-search';
import { matchesRefinements, offersRoomType, sortListings, SORT_LABELS } from '@/lib/search/explore';
import type {
  SearchListing,
  CombinedFilters,
} from '@/lib/search/types';

export type Listing = SearchListing;

// ── Skeleton ──────────────────────────────────────────────────────────────────

export function ListingSkeleton() {
  return (
    <div className="grid grid-cols-1 gap-x-6 gap-y-8 sm:grid-cols-2 lg:grid-cols-3">
      {Array.from({ length: 6 }).map((_, i) => (
        <div key={i} className="animate-pulse">
          <div className="aspect-[4/3] rounded-2xl bg-slate-200" />
          <div className="mt-3 space-y-2">
            <div className="h-4 w-2/3 rounded bg-slate-200" />
            <div className="h-3 w-1/2 rounded bg-slate-200" />
            <div className="h-4 w-1/3 rounded bg-slate-200" />
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
  const searchParams = useSearchParams();
  const campus = useCampus();
  const hydrationDone = useRef(false);

  // The search query is now driven entirely by the navbar — we read it from the
  // URL param and use it directly for client-side filtering.
  const qParamFromUrl = searchParams.get('q') ?? '';

  const {
    genders,
    amenities,
    roomTypes,
    minPrice,
    maxPrice,
    zones,
    maxDistance,
    sortByNearest,
    propertyType,
    bathroom,
    distance,
    sort,
    setAmenities,
    setRoomTypes,
    setPriceRange,
    setPropertyType,
    setBathroom,
    setDistance,
    setSort,
    applyAll,
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

  // ── Results ────────────────────────────────────────────────────────────────
  // One pipeline decides what Explore shows, so the count, the panel's "Show N places" and the grid always agree:
  // text search and structured filters (clientSearch), then kind / bathroom / distance, then the chosen order.
  const resultsFor = useCallback(
    (f: ExploreFilters, q: string) => {
      // Room types and price are judged on the listing's rooms and its "from" rent (matchesRefinements), the
      // numbers the card shows; the text engine handles the search words and the other structured filters.
      const combined: CombinedFilters = {
        searchText: q,
        genders: f.genders,
        amenities: f.amenities,
        roomTypes: [],
        minPrice: null,
        maxPrice: null,
        zones: f.zones,
      };
      const kind = f.propertyType === 'apartment' ? 'apartment' : 'hostel';
      const matched = clientSearch(allListings, combined, allListings.length, 0).listings.filter((l) =>
        matchesRefinements(l, { ...f, propertyType: kind }),
      );
      return sortListings(matched, f.sort);
    },
    [allListings],
  );

  const applied: ExploreFilters = useMemo(
    () => ({
      genders, amenities, roomTypes, minPrice, maxPrice, zones, maxDistance, sortByNearest,
      propertyType, bathroom, distance, sort,
    }),
    [genders, amenities, roomTypes, minPrice, maxPrice, zones, maxDistance, sortByNearest, propertyType, bathroom, distance, sort],
  );
  // Apartments are their own category on Explore (Hostels | Apartments); everything below is scoped to it.
  const category: 'hostel' | 'apartment' = propertyType === 'apartment' ? 'apartment' : 'hostel';
  const categoryListings = useMemo(
    () => allListings.filter((l) => (l.property_type ?? 'hostel') === category),
    [allListings, category],
  );
  const emptyFilters: ExploreFilters = useMemo(
    () => ({
      genders: [], amenities: [], roomTypes: [], minPrice: null, maxPrice: null, zones: [], maxDistance: null,
      sortByNearest: false, propertyType: category === 'apartment' ? 'apartment' : null, bathroom: null, distance: null, sort,
    }),
    [sort, category],
  );

  const results = useMemo(() => resultsFor(applied, qParamFromUrl), [resultsFor, applied, qParamFromUrl]);
  const countFor = useCallback((draft: ExploreFilters) => resultsFor(draft, qParamFromUrl).length, [resultsFor, qParamFromUrl]);
  const total = results.length;

  // ── Progressive rendering for mobile performance ──────────────────────────
  const INITIAL_DISPLAY_COUNT = 12;
  const BATCH_SIZE = 12;
  const displayFilterKey = JSON.stringify([qParamFromUrl, applied]);
  const [displayState, setDisplayState] = useState({ key: '', limit: INITIAL_DISPLAY_COUNT });
  const displayLimit = displayState.key === displayFilterKey ? displayState.limit : INITIAL_DISPLAY_COUNT;
  const loadMoreRef = useRef<HTMLDivElement>(null);
  const showMore = useCallback(
    () =>
      setDisplayState((prev) => ({
        key: displayFilterKey,
        limit: Math.min((prev.key === displayFilterKey ? prev.limit : INITIAL_DISPLAY_COUNT) + BATCH_SIZE, total),
      })),
    [displayFilterKey, total],
  );

  useEffect(() => {
    if (displayLimit >= total) return;
    const observer = new IntersectionObserver((entries) => entries[0]?.isIntersecting && showMore(), {
      rootMargin: '600px 0px',
    });
    const target = loadMoreRef.current;
    if (target) observer.observe(target);
    return () => observer.disconnect();
  }, [displayLimit, total, showMore]);

  const visibleListings = useMemo(() => results.slice(0, displayLimit), [results, displayLimit]);

  // ── URL sync (filter changes only — query sync is owned by the navbar) ────
  // The browser's own history API, which Next keeps in step with useSearchParams: router.replace() made every
  // filter tap a server round trip, so on a slow connection the address bar lagged behind the results.
  useEffect(() => {
    const filterStr = toParams().toString();
    const qParam = qParamFromUrl ? `q=${encodeURIComponent(qParamFromUrl)}` : '';
    const url = qParam || filterStr ? `${basePath}?${[qParam, filterStr].filter(Boolean).join('&')}` : basePath;
    if (url !== `${window.location.pathname}${window.location.search}`) window.history.replaceState(null, '', url);
  }, [qParamFromUrl, applied, basePath, toParams]);

  const handleClearAll = useCallback(() => {
    reset();
    setSort(sort); // clearing filters keeps the chosen order…
    if (category === 'apartment') setPropertyType('apartment'); // …and the category
  }, [reset, setSort, sort, category, setPropertyType]);

  const activeFilterCount =
    genders.length +
    amenities.length +
    roomTypes.length +
    (minPrice || maxPrice ? 1 : 0) +
    zones.length +
    (bathroom ? 1 : 0) +
    (distance ? 1 : 0);

  const [panelOpen, setPanelOpen] = useState(false);

  // ── Quick filters: one tap, applied at once (the panel holds the rest) ────
  const toggleIn = (list: string[], v: string) => (list.includes(v) ? list.filter((x) => x !== v) : [...list, v]);
  const quickFilters = useMemo(() => {
    const chips: { key: string; label: string; active: boolean; onToggle: () => void }[] = [
      { key: 'walk', label: 'Walking distance', active: distance === 'walk', onToggle: () => setDistance(distance === 'walk' ? null : 'walk') },
    ];
    for (const [value, label] of [['bedsitter', 'Bedsitter'], ['single', 'Single room'], ['self_contained_bedsitter', 'Self-contained']] as const) {
      if (categoryListings.some((l) => offersRoomType(l, value))) {
        chips.push({ key: value, label, active: roomTypes.includes(value), onToggle: () => setRoomTypes(toggleIn(roomTypes, value)) });
      }
    }
    chips.push(
      { key: 'under6k', label: 'Under KES 6,000', active: maxPrice === 6000 && !minPrice, onToggle: () => (maxPrice === 6000 && !minPrice ? setPriceRange(null, null) : setPriceRange(null, 6000)) },
      { key: 'wifi', label: 'WiFi included', active: amenities.includes('WiFi'), onToggle: () => setAmenities(toggleIn(amenities, 'WiFi')) },
      { key: 'private', label: 'Private bathroom', active: bathroom === 'private', onToggle: () => setBathroom(bathroom === 'private' ? null : 'private') },
    );
    return chips;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [categoryListings, distance, roomTypes, maxPrice, minPrice, amenities, bathroom]);

  const campusShort =
    campus?.short_name ?? (campus?.name === 'Dedan Kimathi University of Technology' ? 'DeKUT' : campus?.name) ?? 'campus';
  const shortStaysHref = BNB_SEPARATE ? `${BNB_ORIGIN}/` : '/bnb';

  const switchCategory = (next: 'hostel' | 'apartment') => {
    if (next === category) return;
    setRoomTypes([]); // room kinds differ between hostels and apartments
    setPropertyType(next === 'apartment' ? 'apartment' : null);
    window.scrollTo({ top: 0 });
  };
  const nouns = category === 'apartment' ? ['apartment', 'apartments'] : ['hostel', 'hostels'];

  return (
    <div className="min-h-screen bg-page pb-10">
      {/* Categories, Airbnb style: icon and label, the current one underlined. Short stays are another product. */}
      <nav aria-label="Category" className="border-b border-line bg-page">
        <div className="mx-auto flex max-w-6xl items-end gap-7 overflow-x-auto px-4 pt-3 scrollbar-none lg:px-8">
          {(
            [
              ['hostel', 'Hostels', '/images/categories/hostels.png'],
              ['apartment', 'Apartments', '/images/categories/apartments.png'],
            ] as const
          ).map(([key, label, icon]) => {
            const active = category === key;
            return (
              <button
                key={key}
                type="button"
                aria-current={active ? 'page' : undefined}
                onClick={() => switchCategory(key)}
                className={cn(
                  'flex shrink-0 flex-col items-center gap-1 border-b-2 pb-2.5 text-[13px] font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary',
                  active ? 'border-ink text-ink' : 'border-transparent text-ink-muted opacity-80 hover:border-slate-300 hover:text-ink hover:opacity-100',
                )}
              >
                <Image src={icon} alt="" width={28} height={28} className="h-7 w-7" aria-hidden />
                {label}
              </button>
            );
          })}
          <a
            href={shortStaysHref}
            className="flex shrink-0 flex-col items-center gap-1 border-b-2 border-transparent pb-2.5 text-[13px] font-semibold text-ink-muted opacity-80 hover:border-slate-300 hover:text-ink hover:opacity-100"
          >
            <Image src="/images/categories/short-stays.png" alt="" width={28} height={28} className="h-7 w-7" aria-hidden />
            {BNB_SEPARATE ? 'RumiaBnB | Short stays' : 'Short stays'}
          </a>
        </div>
      </nav>

      {/* Sticky filter bar under the app header, Airbnb/Zillow style: Filters with its count, then one-tap chips. */}
      <div className="sticky top-[var(--shell-header-h)] z-30 border-b border-line bg-page/95 backdrop-blur supports-[backdrop-filter]:bg-page/80">
        <div className="mx-auto flex max-w-6xl items-center gap-2 overflow-x-auto px-4 py-3 scrollbar-none lg:flex-wrap lg:overflow-visible lg:px-8">
          <button
            type="button"
            onClick={() => setPanelOpen(true)}
            className={cn(
              'inline-flex min-h-10 shrink-0 items-center gap-2 rounded-full border px-4 text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary',
              activeFilterCount > 0 ? 'border-ink bg-ink text-white' : 'border-slate-300 bg-white text-ink hover:border-ink',
            )}
          >
            <SlidersHorizontal className="h-4 w-4" aria-hidden />
            Filters
            {activeFilterCount > 0 && (
              <span className="inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-white px-1 text-xs font-bold text-ink">
                {activeFilterCount}
              </span>
            )}
          </button>
          <span className="h-6 w-px shrink-0 bg-line" aria-hidden />
          {quickFilters.map((c) => (
            <button
              key={c.key}
              type="button"
              aria-pressed={c.active}
              onClick={c.onToggle}
              className={cn(
                'inline-flex min-h-10 shrink-0 items-center rounded-full border px-4 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary',
                c.active ? 'border-ink bg-ink text-white' : 'border-slate-300 bg-white text-ink hover:border-ink',
              )}
            >
              {c.label}
            </button>
          ))}
        </div>
      </div>

      <div className="mx-auto max-w-6xl px-4 lg:px-8">
        <div className="flex flex-wrap items-end justify-between gap-x-4 gap-y-2 pb-5 pt-5">
          <div>
            {/* Area pages bring their own heading (hideHeader): one h1 per page. */}
            {!hideHeader && (
              <h1 className="font-heading text-xl font-bold tracking-tight text-ink sm:text-2xl">
                {qParamFromUrl ? `Results for “${qParamFromUrl}”` : `${category === 'apartment' ? 'Apartments' : 'Hostels'} near ${campusShort}`}
              </h1>
            )}
            <p className={cn('text-sm text-ink-muted', !hideHeader && 'mt-0.5')}>
              {total} {total === 1 ? nouns[0] : nouns[1]}
              {' · prices per month'}
              {(activeFilterCount > 0 || qParamFromUrl) && (
                <>
                  {' · '}
                  <button type="button" onClick={handleClearAll} className="font-semibold text-ink underline underline-offset-4">
                    Clear filters
                  </button>
                </>
              )}
            </p>
          </div>
          <label className="inline-flex items-center gap-2 text-sm text-ink-muted">
            Sort
            <select
              value={sort}
              onChange={(e) => setSort(e.target.value as ExploreSort)}
              className="min-h-10 rounded-full border border-slate-300 bg-white px-3 pr-8 text-sm font-semibold text-ink focus:border-ink focus:outline-none focus:ring-1 focus:ring-ink"
            >
              {(Object.keys(SORT_LABELS) as ExploreSort[]).map((k) => (
                <option key={k} value={k}>
                  {SORT_LABELS[k]}
                </option>
              ))}
            </select>
          </label>
        </div>

        {total > 0 ? (
          <>
            <div className="grid grid-cols-1 gap-x-6 gap-y-9 sm:grid-cols-2 lg:grid-cols-3">
              {visibleListings.map((item, i) => (
                <ResultCard
                  key={item.id}
                  item={item}
                  priority={i < 3}
                  comparing={isCompareSelected(item.id)}
                  onToggleCompare={() => handleCompareToggle(item)}
                />
              ))}
            </div>

            {displayLimit < total && (
              <div ref={loadMoreRef} className="flex justify-center py-10">
                <button
                  type="button"
                  onClick={showMore}
                  className="inline-flex min-h-11 items-center rounded-full border border-ink px-6 text-sm font-semibold text-ink hover:bg-ink hover:text-white"
                >
                  Show more places ({total - displayLimit})
                </button>
              </div>
            )}
          </>
        ) : (
          <div className="rounded-3xl border border-line bg-raised px-6 py-16 text-center">
            <p className="text-lg font-semibold text-ink">
              {categoryListings.length === 0 ? `No ${nouns[1]} listed yet` : 'No exact matches'}
            </p>
            <p className="mx-auto mt-1 max-w-sm text-sm text-ink-muted">
              {categoryListings.length === 0
                ? `New ${nouns[1]} are being added. Check back soon, or browse ${category === 'apartment' ? 'hostels' : 'apartments'} meanwhile.`
                : 'Try removing a filter, widening your price range or searching a nearby area.'}
            </p>
            {categoryListings.length > 0 && <button
              type="button"
              onClick={handleClearAll}
              className="mt-6 inline-flex min-h-11 items-center rounded-xl bg-ink px-5 text-sm font-semibold text-white hover:bg-ink/90"
            >
              Clear all filters
            </button>}
          </div>
        )}

        {/* Short stays are a different product (RumiaBnB); apartments above are monthly rentals like the hostels. */}
        <a
          href={shortStaysHref}
          className="mt-12 flex items-center justify-between gap-4 rounded-2xl border border-line bg-raised px-5 py-4 transition-colors hover:border-ink"
        >
          <span>
            <span className="block text-[15px] font-semibold text-ink">Staying just a few nights?</span>
            <span className="block text-sm text-ink-muted">Furnished short stays are on RumiaBnB.</span>
          </span>
          <ArrowRight className="h-5 w-5 shrink-0 text-ink" aria-hidden />
        </a>

        <div className="mt-8">
          <EarlyAccessBanner hostelCount={allListings.length} />
        </div>
      </div>

      <FilterPanel
        open={panelOpen}
        onOpenChange={setPanelOpen}
        current={applied}
        listings={categoryListings}
        countFor={countFor}
        emptyFilters={emptyFilters}
        onApply={(draft) => {
          applyAll(draft);
          setPanelOpen(false);
          window.scrollTo({ top: 0, behavior: 'smooth' });
        }}
      />
    </div>
  );
}
