'use client';

import * as React from 'react';
import { useRouter, usePathname, useSearchParams } from 'next/navigation';
import Image from 'next/image';
import Link from 'next/link';
import { motion, AnimatePresence, type Variants } from 'framer-motion';
import {
  Search,
  X,
  Loader2,
  ArrowRight,
  MapPin,
  Sparkles,
  SlidersHorizontal,
  Tag,
  CalendarCheck,
} from 'lucide-react';
import { useDebounce } from '@/hooks/use-debounce';
import { useFocusTrap } from '@/hooks/use-focus-trap';
import { searchApi } from '@/lib/api/search';
import { parseQuery } from '@/lib/search/parse-query';
import { useFilterStore, type FilterState } from '@/stores/filter-store';
import { FilterBottomSheet } from '@/components/ui/filter/filter-bottom-sheet';
import { ActiveFilterChips } from '@/components/ui/filter/active-filter-chips';
import { createClient } from '@/lib/supabase/client';
import type { Listing } from '@/types';

// ─── Fallback blur placeholder ────────────────────────────────────────────────
const FALLBACK_BLUR =
  'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCA2MDAgNDUwIj48cmVjdCB3aWR0aD0iNjAwIiBoZWlnaHQ9IjQ1MCIgZmlsbD0iI2UyZThmMCIvPjwvc3ZnPg==';

// ─── Utility: count active filter groups ─────────────────────────────────────
export function countActiveFilterGroups(state: FilterState): number {
  return (
    (state.genders.length > 0 ? 1 : 0) +
    (state.amenities.length > 0 ? 1 : 0) +
    (state.roomTypes.length > 0 ? 1 : 0) +
    (state.minPrice !== null || state.maxPrice !== null ? 1 : 0) +
    (state.zones.length > 0 ? 1 : 0) +
    (state.maxDistance !== null ? 1 : 0)
  );
}

// ─── Animation variants (GPU-only: transform + opacity) ───────────────────────
const mobileVariants: Variants = {
  hidden: { opacity: 0, y: -8 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.2, ease: 'easeOut' as const },
  },
  exit: {
    opacity: 0,
    y: -8,
    transition: { duration: 0.15, ease: 'easeIn' as const },
  },
};

const desktopVariants: Variants = {
  hidden: { opacity: 0, scale: 0.97, y: -4 },
  visible: {
    opacity: 1,
    scale: 1,
    y: 0,
    transition: { duration: 0.2, ease: 'easeOut' as const },
  },
  exit: {
    opacity: 0,
    scale: 0.97,
    y: -4,
    transition: { duration: 0.15 },
  },
};

const backdropVariants: Variants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { duration: 0.15 } },
  exit: { opacity: 0, transition: { duration: 0.1 } },
};

// ─── IdleSearchPill ───────────────────────────────────────────────────────────
interface IdleSearchPillProps {
  query: string;
  activeFilterCount: number;
  isExpanded: boolean;
  isBnbPage: boolean;
  onActivate: () => void;
  triggerRef: React.RefObject<HTMLButtonElement>;
}

function IdleSearchPill({
  query,
  activeFilterCount,
  isExpanded,
  isBnbPage,
  onActivate,
  triggerRef,
}: IdleSearchPillProps) {
  const displayQuery = query
    ? query.length > 24
      ? query.slice(0, 24) + '…'
      : query
    : null;

  return (
    <button
      ref={triggerRef}
      type="button"
      onClick={onActivate}
      aria-label={isBnbPage ? 'Search stays' : 'Search hostels'}
      aria-expanded={isExpanded}
      aria-controls="navbar-search-panel"
      aria-haspopup="dialog"
      style={{ touchAction: 'manipulation' }}
      className="flex h-9 w-full items-center gap-2 rounded-full border border-slate-200 bg-white px-3 text-sm shadow-sm transition-colors hover:border-slate-300 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/30"
    >
      <Search className="h-4 w-4 shrink-0 text-slate-400" />

      <span className="min-w-0 flex-1 text-left">
        {displayQuery ? (
          <span className="truncate font-medium text-slate-900">
            {displayQuery}
          </span>
        ) : (
          <span className="text-slate-400">
            {isBnbPage ? 'Search stays, areas…' : 'Search hostels, areas…'}
          </span>
        )}
      </span>

      {activeFilterCount > 0 && (
        <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-bold text-emerald-700 ring-1 ring-emerald-200">
          Filters&nbsp;·&nbsp;{activeFilterCount}
        </span>
      )}
    </button>
  );
}

// ─── NavbarSearch (root) ──────────────────────────────────────────────────────
export function NavbarSearch() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const isHostelsPage =
    pathname === '/hostels' || pathname.startsWith('/hostels/');
  const isBnbPage = pathname === '/bnb' || pathname.startsWith('/bnb/');

  // ── Filter store ────────────────────────────────────────────────────────────
  const filterState = useFilterStore();
  const {
    genders,
    amenities,
    roomTypes,
    minPrice,
    maxPrice,
    zones,
    maxDistance,
    sortByNearest,
    setGenders,
    setAmenities,
    setRoomTypes,
    setPriceRange,
    setZones,
    setMaxDistance,
    setSortByNearest,
    reset,
    toParams,
  } = filterState;

  // ── Local state ─────────────────────────────────────────────────────────────
  const qFromUrl = searchParams.get('q') ?? '';
  const [isOpen, setIsOpen] = React.useState(false);
  const [query, setQuery] = React.useState(qFromUrl);
  const [results, setResults] = React.useState<Listing[]>([]);
  const [totalCount, setTotalCount] = React.useState(0);
  const [isLoading, setIsLoading] = React.useState(false);
  const [selectedIndex, setSelectedIndex] = React.useState(-1);
  const [isLoggedIn, setIsLoggedIn] = React.useState(false);
  const [isMobile, setIsMobile] = React.useState(false);

  const debouncedQuery = useDebounce(query, 250);

  // ── Refs ────────────────────────────────────────────────────────────────────
  const containerRef = React.useRef<HTMLDivElement>(null);
  const panelRef = React.useRef<HTMLDivElement>(null);
  const inputRef = React.useRef<HTMLInputElement>(null);
  const triggerRef = React.useRef<HTMLButtonElement>(null);

  // ── Focus trap ──────────────────────────────────────────────────────────────
  useFocusTrap(panelRef, isOpen);

  // ── Viewport detection ──────────────────────────────────────────────────────
  React.useEffect(() => {
    const mq = window.matchMedia('(max-width: 767px)');
    setIsMobile(mq.matches);
    const handler = (e: MediaQueryListEvent) => setIsMobile(e.matches);
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, []);

  // ── Auth check ──────────────────────────────────────────────────────────────
  React.useEffect(() => {
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

  // ── Sync query from URL ─────────────────────────────────────────────────────
  React.useEffect(() => {
    setQuery(qFromUrl);
  }, [qFromUrl]);

  // ── Close on scroll ─────────────────────────────────────────────────────────
  React.useEffect(() => {
    if (!isOpen) return;
    const closePanel = () => setIsOpen(false);
    window.addEventListener('scroll', closePanel, { passive: true });
    return () => window.removeEventListener('scroll', closePanel);
  }, [isOpen]);

  // ── Close on outside click ──────────────────────────────────────────────────
  React.useEffect(() => {
    if (!isOpen) return;
    const handleMouseDown = (e: MouseEvent) => {
      if (
        containerRef.current &&
        !containerRef.current.contains(e.target as Node)
      ) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleMouseDown);
    return () => document.removeEventListener('mousedown', handleMouseDown);
  }, [isOpen]);

  // ── Escape key ──────────────────────────────────────────────────────────────
  React.useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setIsOpen(false);
        triggerRef.current?.focus();
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen]);

  // ── Auto-focus input on open ────────────────────────────────────────────────
  React.useEffect(() => {
    if (isOpen) {
      // Small delay to allow the panel to render before focusing
      const id = setTimeout(() => inputRef.current?.focus(), 50);
      return () => clearTimeout(id);
    }
  }, [isOpen]);

  // ── On /hostels: sync debounced query to URL ────────────────────────────────
  React.useEffect(() => {
    if (!isHostelsPage) return;
    const trimmed = debouncedQuery.trim();
    const currentQ = searchParams.get('q') ?? '';
    if (trimmed === currentQ) return;
    const params = new URLSearchParams(searchParams.toString());
    if (trimmed) {
      params.set('q', trimmed);
    } else {
      params.delete('q');
    }
    router.replace(`${pathname}?${params.toString()}`, { scroll: false });
  }, [debouncedQuery, isHostelsPage, pathname, router, searchParams]);

  // ── Off /hostels: autocomplete ──────────────────────────────────────────────
  React.useEffect(() => {
    if (isHostelsPage) {
      setResults([]);
      setIsLoading(false);
      return;
    }
    const trimmed = debouncedQuery.trim();
    if (trimmed.length < 2) {
      setResults([]);
      setTotalCount(0);
      setIsLoading(false);
      return;
    }
    let active = true;
    setIsLoading(true);
    searchApi
      .search({ q: trimmed, limit: 5 })
      .then((res) => {
        if (!active) return;
        setResults(res.items?.slice(0, 5) || []);
        setTotalCount(res.total || 0);
      })
      .catch((err) => {
        if (!active) return;
        console.error('Navbar search error:', err);
        setResults([]);
        setTotalCount(0);
      })
      .finally(() => {
        if (active) setIsLoading(false);
      });
    return () => {
      active = false;
    };
  }, [debouncedQuery, isHostelsPage]);

  // ── Parsed NLP tokens ───────────────────────────────────────────────────────
  const parsedTokens = React.useMemo(() => {
    if (!query.trim()) return [];
    const parsed = parseQuery(query);
    const tags: string[] = [];
    if (parsed.gender)
      tags.push(parsed.gender === 'female' ? 'Ladies' : 'Gents');
    if (parsed.roomType) tags.push(parsed.roomType.replace(/_/g, ' '));
    if (parsed.maxPrice)
      tags.push(`Under KES ${parsed.maxPrice.toLocaleString()}`);
    if (parsed.minPrice)
      tags.push(`From KES ${parsed.minPrice.toLocaleString()}`);
    if (parsed.area) tags.push(parsed.area);
    if (parsed.amenities.length > 0) tags.push(...parsed.amenities);
    return tags;
  }, [query]);

  // ── Derived values ──────────────────────────────────────────────────────────
  const activeFilterCount = countActiveFilterGroups({
    genders,
    amenities,
    roomTypes,
    minPrice,
    maxPrice,
    zones,
    maxDistance,
    sortByNearest,
  });
  const priceFilterActive = minPrice !== null || maxPrice !== null;
  const shouldShowAutocomplete =
    !isHostelsPage && isOpen && debouncedQuery.trim().length >= 2;

  // ── Handlers ────────────────────────────────────────────────────────────────
  const handleOpen = () => setIsOpen(true);

  const handleClose = () => {
    setIsOpen(false);
    triggerRef.current?.focus();
  };

  const handleSearchSubmit = (e?: React.FormEvent) => {
    if (e) e.preventDefault();

    const trimmed = query.trim();

    // If a result is highlighted, navigate to it
    if (selectedIndex >= 0 && selectedIndex < results.length) {
      const selected = results[selectedIndex];
      const targetUrl = selected.slug
        ? `/hostels/${selected.county || 'nyeri'}/${selected.area || 'dekut'}/${selected.slug}`
        : `/listing/${selected.id}`;
      router.push(targetUrl);
      handleClose();
      return;
    }

    if (isHostelsPage) {
      const params = new URLSearchParams(searchParams.toString());
      if (trimmed) {
        params.set('q', trimmed);
      } else {
        params.delete('q');
      }
      router.replace(
        `${pathname}${params.toString() ? `?${params.toString()}` : ''}`,
        { scroll: false },
      );
    } else {
      const filterParams = toParams();
      const parts: string[] = [];
      if (trimmed) parts.push(`q=${encodeURIComponent(trimmed)}`);
      if (filterParams.toString()) parts.push(filterParams.toString());
      router.push(`/hostels${parts.length ? `?${parts.join('&')}` : ''}`);
    }

    setSelectedIndex(-1);
    handleClose();
  };

  const handleClear = () => {
    setQuery('');
    setResults([]);
    setSelectedIndex(-1);
    if (isHostelsPage) {
      const params = new URLSearchParams(searchParams.toString());
      params.delete('q');
      router.replace(
        `${pathname}${params.toString() ? `?${params.toString()}` : ''}`,
        { scroll: false },
      );
    }
    // Keep panel open
    inputRef.current?.focus();
  };

  const handleQueryKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex((prev) => (prev < results.length - 1 ? prev + 1 : prev));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex((prev) => (prev > -1 ? prev - 1 : -1));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      handleSearchSubmit();
    }
  };

  const handleMobileApply = (draft: FilterState) => {
    setGenders(draft.genders);
    setAmenities(draft.amenities);
    setRoomTypes(draft.roomTypes);
    setPriceRange(draft.minPrice, draft.maxPrice);
    setZones(draft.zones);
    setMaxDistance(draft.maxDistance);
    setSortByNearest(draft.sortByNearest);

    // Navigate to /hostels with the applied filters
    if (!isHostelsPage) {
      const filterParams = toParams();
      const parts: string[] = [];
      if (query.trim()) parts.push(`q=${encodeURIComponent(query.trim())}`);
      if (filterParams.toString()) parts.push(filterParams.toString());
      router.push(`/hostels${parts.length ? `?${parts.join('&')}` : ''}`);
      handleClose();
    }
  };

  const handlePriceApply = (draft: FilterState) => {
    setPriceRange(draft.minPrice, draft.maxPrice);
    if (!isHostelsPage) {
      const filterParams = toParams();
      const parts: string[] = [];
      if (query.trim()) parts.push(`q=${encodeURIComponent(query.trim())}`);
      if (filterParams.toString()) parts.push(filterParams.toString());
      router.push(`/hostels${parts.length ? `?${parts.join('&')}` : ''}`);
      handleClose();
    }
  };

  const handleBookTour = () => {
    router.push(isLoggedIn ? '/account/book-tour' : '/book-tour');
    handleClose();
  };

  const currentFilters: FilterState = {
    genders,
    amenities,
    roomTypes,
    minPrice,
    maxPrice,
    zones,
    maxDistance,
    sortByNearest,
  };

  // ── Render ──────────────────────────────────────────────────────────────────
  return (
    <div ref={containerRef} className="relative w-full max-w-[360px]">
      {/* ── Idle search pill ── */}
      <IdleSearchPill
        query={query}
        activeFilterCount={activeFilterCount}
        isExpanded={isOpen}
        isBnbPage={isBnbPage}
        onActivate={handleOpen}
        triggerRef={triggerRef as React.RefObject<HTMLButtonElement>}
      />

      <AnimatePresence>
        {isOpen && (
          <>
            {/* ── Backdrop ── */}
            <motion.div
              key="search-backdrop"
              variants={backdropVariants}
              initial="hidden"
              animate="visible"
              exit="exit"
              aria-hidden="true"
              onClick={handleClose}
              className="fixed inset-0 z-40 bg-black/30"
            />

            {/* ── Expanded Search Panel ── */}
            <motion.div
              key="search-panel"
              ref={panelRef}
              id="navbar-search-panel"
              role="dialog"
              aria-label={isBnbPage ? 'Search stays' : 'Search hostels'}
              aria-modal="true"
              variants={isMobile ? mobileVariants : desktopVariants}
              initial="hidden"
              animate="visible"
              exit="exit"
              className={[
                'z-50 bg-white',
                isMobile
                  ? // Mobile: full-width fixed panel slides from navbar
                    'fixed inset-x-0 top-[56px] overflow-y-auto rounded-b-2xl border-b border-x border-slate-200 shadow-xl max-h-[calc(100dvh-56px-env(keyboard-inset-height,0px))]'
                  : // Desktop: absolute dropdown anchored to search area
                    'absolute left-1/2 top-full mt-2 w-[480px] -translate-x-1/2 rounded-2xl border border-slate-200 shadow-2xl max-h-[80vh] overflow-y-auto',
              ].join(' ')}
            >
              <div className="p-3 sm:p-4">
                {/* ── Search input ── */}
                <form onSubmit={handleSearchSubmit} className="relative">
                  <Search className="pointer-events-none absolute left-3.5 top-1/2 h-[18px] w-[18px] -translate-y-1/2 text-slate-400" />
                  <input
                    ref={inputRef}
                    type="text"
                    value={query}
                    onChange={(e) => {
                      setQuery(e.target.value);
                      setSelectedIndex(-1);
                    }}
                    onKeyDown={handleQueryKeyDown}
                    placeholder="Search by name, area, or price…"
                    enterKeyHint="search"
                    autoComplete="off"
                    role="combobox"
                    aria-autocomplete="list"
                    aria-controls={
                      shouldShowAutocomplete
                        ? 'navbar-autocomplete-list'
                        : undefined
                    }
                    aria-expanded={shouldShowAutocomplete}
                    style={{ touchAction: 'manipulation' }}
                    className="h-12 w-full rounded-xl border border-slate-200 bg-slate-50 pl-10 pr-10 text-[15px] font-medium text-slate-900 transition-all placeholder:text-slate-500 focus:border-emerald-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/30"
                  />
                  {isLoading ? (
                    <Loader2 className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-emerald-600" />
                  ) : query ? (
                    <button
                      type="button"
                      onClick={handleClear}
                      aria-label="Clear search"
                      style={{ touchAction: 'manipulation' }}
                      className="absolute right-3 top-1/2 -translate-y-1/2 rounded-full p-1 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  ) : null}
                </form>

                {/* ── NLP intent chips ── */}
                {parsedTokens.length > 0 && (
                  <div className="mt-2.5 flex flex-wrap items-center gap-1.5 rounded-lg bg-slate-50 px-3 py-2">
                    <span className="flex items-center gap-1 text-[11px] font-bold uppercase tracking-wide text-slate-400">
                      <Sparkles className="h-3 w-3 text-emerald-500" />
                      Filters:
                    </span>
                    {parsedTokens.map((tag, idx) => (
                      <span
                        key={idx}
                        className="inline-flex items-center rounded-md border border-emerald-100 bg-emerald-50 px-2 py-0.5 text-xs font-semibold text-emerald-700"
                      >
                        {tag}
                      </span>
                    ))}
                  </div>
                )}

                {/* ── Filter controls row ── */}
                <div className="mt-3 flex flex-nowrap items-center gap-2 overflow-x-auto pb-1 scrollbar-none">
                  {/* Filter button */}
                  <FilterBottomSheet
                    currentFilters={currentFilters}
                    onApply={handleMobileApply}
                    mode="all"
                    trigger={
                      <button
                        type="button"
                        style={{ touchAction: 'manipulation' }}
                        className="shrink-0 inline-flex items-center gap-1.5 rounded-full bg-emerald-500 px-4 py-2 text-sm font-semibold text-white shadow-sm shadow-emerald-200 transition-colors hover:bg-emerald-600 cursor-pointer"
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

                  {/* Price button */}
                  <FilterBottomSheet
                    currentFilters={currentFilters}
                    onApply={handlePriceApply}
                    mode="price"
                    trigger={
                      <button
                        type="button"
                        style={{ touchAction: 'manipulation' }}
                        className="shrink-0 inline-flex items-center gap-1.5 rounded-full bg-rose-500 px-4 py-2 text-sm font-semibold text-white shadow-sm shadow-rose-200 transition-colors hover:bg-rose-600 cursor-pointer"
                      >
                        <Tag className="h-3.5 w-3.5" />
                        Price
                        {priceFilterActive && (
                          <span className="ml-0.5 inline-flex h-5 min-w-[20px] items-center justify-center rounded-full bg-white/20 px-1.5 text-xs font-bold leading-none">
                            1
                          </span>
                        )}
                      </button>
                    }
                  />

                  {!isBnbPage && (
                    <button
                      type="button"
                      onClick={handleBookTour}
                      style={{ touchAction: 'manipulation' }}
                      className="shrink-0 inline-flex items-center gap-1.5 rounded-full bg-slate-900 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-slate-800 cursor-pointer"
                    >
                      <CalendarCheck className="h-3.5 w-3.5" />
                      Book a Tour
                    </button>
                  )}
                </div>

                {/* ── Active filter chips ── */}
                {activeFilterCount > 0 && (
                  <div className="mt-3">
                    <ActiveFilterChips
                      filters={currentFilters}
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
                      onRemoveZone={(v) =>
                        setZones(zones.filter((z) => z !== v))
                      }
                      onRemoveMaxDistance={() => setMaxDistance(null)}
                      onRemoveSortByNearest={() => setSortByNearest(false)}
                      onClearAll={reset}
                    />
                  </div>
                )}
              </div>

              {/* ── Autocomplete results (non-/hostels only) ── */}
              {shouldShowAutocomplete && (
                <div className="border-t border-slate-100">
                  {/* Results list */}
                  <ul
                    id="navbar-autocomplete-list"
                    role="listbox"
                    className="max-h-[320px] divide-y divide-slate-100/60 overflow-y-auto py-1"
                  >
                    {results.length > 0 ? (
                      results.map((item, idx) => {
                        const isSelected = selectedIndex === idx;
                        const images = item.images || [];
                        const firstImage = images[0]?.r2_url;
                        const href = item.slug
                          ? `/hostels/${item.county || 'nyeri'}/${item.area || 'dekut'}/${item.slug}`
                          : `/listing/${item.id}`;
                        const priceText = item.price_single
                          ? `KES ${item.price_single.toLocaleString()}/mo`
                          : `KES ${item.price?.toLocaleString()}/mo`;

                        return (
                          <li
                            key={item.id}
                            role="option"
                            aria-selected={isSelected}
                          >
                            <Link
                              href={href}
                              onClick={handleClose}
                              className={`flex items-center gap-3 px-4 py-2.5 transition-colors ${
                                isSelected
                                  ? 'bg-emerald-50 text-emerald-950'
                                  : 'hover:bg-slate-50 text-slate-900'
                              }`}
                            >
                              <div className="relative h-11 w-11 shrink-0 overflow-hidden rounded-lg border border-slate-100 bg-slate-100">
                                {firstImage ? (
                                  <Image
                                    src={firstImage}
                                    alt={item.title}
                                    fill
                                    className="object-cover"
                                    sizes="44px"
                                    placeholder="blur"
                                    blurDataURL={
                                      images[0]?.blur_data_url || FALLBACK_BLUR
                                    }
                                  />
                                ) : (
                                  <div className="flex h-full w-full items-center justify-center text-slate-400">
                                    <Search className="h-4 w-4" />
                                  </div>
                                )}
                              </div>
                              <div className="min-w-0 flex-1">
                                <div className="flex items-center justify-between gap-2">
                                  <p className="truncate text-sm font-bold text-slate-900">
                                    {item.title}
                                  </p>
                                  <span className="shrink-0 text-xs font-extrabold text-emerald-600">
                                    {priceText}
                                  </span>
                                </div>
                                <div className="mt-0.5 flex items-center gap-1.5 text-[11px] font-medium text-slate-500">
                                  <MapPin className="h-3 w-3 shrink-0 text-slate-400" />
                                  <span className="truncate">
                                    {item.area || item.location || 'Nyeri'}
                                    {item.specific_location
                                      ? ` · ${item.specific_location}`
                                      : ''}
                                  </span>
                                  {item.room_type && (
                                    <span className="shrink-0 rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-semibold text-slate-600">
                                      {item.room_type}
                                    </span>
                                  )}
                                </div>
                              </div>
                            </Link>
                          </li>
                        );
                      })
                    ) : !isLoading ? (
                      <li
                        role="option"
                        aria-selected={false}
                        className="px-4 py-6 text-center"
                      >
                        <p className="text-xs font-semibold text-slate-600">
                          {isBnbPage
                            ? `No stays found matching "${query}"`
                            : `No hostels found matching "${query}"`}
                        </p>
                        <p className="mt-1 text-[11px] text-slate-400">
                          Try a different area or room type.
                        </p>
                      </li>
                    ) : (
                      <li className="flex items-center justify-center py-8">
                        <Loader2 className="h-5 w-5 animate-spin text-emerald-600" />
                      </li>
                    )}
                  </ul>

                  {/* Footer: view all */}
                  <div className="border-t border-slate-100 bg-slate-50/80 px-4 py-2.5">
                    <button
                      type="button"
                      onClick={() => handleSearchSubmit()}
                      style={{ touchAction: 'manipulation' }}
                      className="flex w-full items-center justify-between rounded-xl px-2.5 py-1.5 text-xs font-bold text-emerald-700 transition-colors hover:bg-emerald-50 cursor-pointer"
                    >
                      <span>
                        {totalCount > 0
                          ? `View all ${totalCount} results`
                          : isBnbPage
                            ? `Search all stays for "${query}"`
                            : `Search all hostels for "${query}"`}
                      </span>
                      <ArrowRight className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
              )}
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}
