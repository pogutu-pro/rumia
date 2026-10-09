'use client';

import { listingPath } from '@/lib/utils/listing-path';
import * as React from 'react';
import { useRouter, usePathname, useSearchParams } from 'next/navigation';
import Image from 'next/image';
import Link from 'next/link';
import { motion, AnimatePresence } from 'framer-motion';
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

const FALLBACK_BLUR =
  'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCA2MDAgNDUwIj48cmVjdCB3aWR0aD0iNjAwIiBoZWlnaHQ9IjQ1MCIgZmlsbD0iI2UyZThmMCIvPjwvc3ZnPg==';

export function countActiveFilterGroups(state: FilterState): number {
  return (
    (state.genders.length > 0 ? 1 : 0) +
    (state.amenities.length > 0 ? 1 : 0) +
    (state.roomTypes.length > 0 ? 1 : 0) +
    (state.minPrice !== null || state.maxPrice !== null ? 1 : 0) +
    (state.zones.length > 0 ? 1 : 0) +
    (state.maxDistance !== null ? 1 : 0) +
    (state.sortByNearest ? 1 : 0)
  );
}

function IdleSearchPill({
  query,
  activeFilterCount,
  isExpanded,
  isBnbPage,
  onActivate,
  triggerRef,
}: {
  query: string;
  activeFilterCount: number;
  isExpanded: boolean;
  isBnbPage: boolean;
  onActivate: () => void;
  triggerRef: React.RefObject<HTMLButtonElement | null>;
}) {
  const displayQuery =
    query && query.length > 28 ? query.slice(0, 28) + '…' : query || null;
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
      className="flex h-11 w-full items-center gap-2.5 rounded-full border border-slate-200 bg-white px-4 text-sm shadow-sm transition-all hover:border-slate-300 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/30 active:scale-[0.98]"
    >
      <Search className="h-[18px] w-[18px] shrink-0 text-slate-400" />
      <span className="min-w-0 flex-1 text-left">
        {displayQuery ? (
          <span className="truncate font-semibold text-slate-900">{displayQuery}</span>
        ) : (
          <span className="font-medium text-slate-500">
            {isBnbPage ? 'Search stays, areas…' : 'Search hostels, areas…'}
          </span>
        )}
      </span>
      {activeFilterCount > 0 && (
        <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-bold text-emerald-700 ring-1 ring-emerald-200">
          {activeFilterCount}
        </span>
      )}
    </button>
  );
}

function SearchCardContent({
  query,
  setQuery,
  isTypingRef,
  setSelectedIndex,
  inputRef,
  isLoading,
  showSpinner,
  onClear,
  onKeyDown,
  onSubmit,
  parsedTokens,
  currentFilters,
  activeFilterCount,
  priceFilterActive,
  isBnbPage,
  onBookTour,
  onMobileApply,
  onPriceApply,
  setGenders,
  setAmenities,
  setRoomTypes,
  setPriceRange,
  setZones,
  setMaxDistance,
  setSortByNearest,
  genders,
  amenities,
  roomTypes,
  zones,
  reset,
  shouldShowAutocomplete,
}: {
  query: string;
  setQuery: (v: string) => void;
  isTypingRef: React.RefObject<boolean>;
  setSelectedIndex: React.Dispatch<React.SetStateAction<number>>;
  inputRef: React.RefObject<HTMLInputElement | null>;
  isLoading: boolean;
  showSpinner: boolean;
  onClear: () => void;
  onKeyDown: (e: React.KeyboardEvent<HTMLInputElement>) => void;
  onSubmit: (e?: React.FormEvent) => void;
  parsedTokens: string[];
  currentFilters: FilterState;
  activeFilterCount: number;
  priceFilterActive: boolean;
  isBnbPage: boolean;
  onBookTour: () => void;
  onMobileApply: (d: FilterState) => void;
  onPriceApply: (d: FilterState) => void;
  setGenders: (v: string[]) => void;
  setAmenities: (v: string[]) => void;
  setRoomTypes: (v: string[]) => void;
  setPriceRange: (a: number | null, b: number | null) => void;
  setZones: (v: string[]) => void;
  setMaxDistance: (v: number | null) => void;
  setSortByNearest: (v: boolean) => void;
  genders: string[];
  amenities: string[];
  roomTypes: string[];
  zones: string[];
  reset: () => void;
  shouldShowAutocomplete: boolean;
}) {
  return (
    <>
      <form onSubmit={onSubmit} className="relative">
        <Search className="pointer-events-none absolute left-3.5 top-1/2 h-[18px] w-[18px] -translate-y-1/2 text-slate-400" />
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={(e) => {
            isTypingRef.current = true;
            setQuery(e.target.value);
            setSelectedIndex(-1);
            setTimeout(() => {
              isTypingRef.current = false;
            }, 400);
          }}
          onKeyDown={onKeyDown}
          placeholder="Search by name, area, or price…"
          enterKeyHint="search"
          autoComplete="off"
          role="combobox"
          aria-autocomplete="list"
          aria-controls={shouldShowAutocomplete ? 'navbar-autocomplete-list' : undefined}
          aria-expanded={shouldShowAutocomplete}
          style={{ touchAction: 'manipulation' }}
          className="h-12 w-full rounded-xl border border-slate-200 bg-slate-50 pl-10 pr-10 text-[15px] font-medium text-slate-900 transition-all placeholder:text-slate-500 focus:border-emerald-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20 lg:h-[50px]"
        />
        {showSpinner ? (
          <Loader2 className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-emerald-600" />
        ) : query ? (
          <button
            type="button"
            onClick={onClear}
            aria-label="Clear search"
            style={{ touchAction: 'manipulation' }}
            className="absolute right-3 top-1/2 -translate-y-1/2 rounded-full p-1.5 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600"
          >
            <X className="h-4 w-4" />
          </button>
        ) : null}
      </form>

      {parsedTokens.length > 0 && (
        <div className="mt-3 flex flex-wrap items-center gap-1.5 rounded-xl bg-slate-50 px-3 py-2.5">
          <span className="flex items-center gap-1 text-xs font-bold uppercase tracking-wide text-slate-400">
            <Sparkles className="h-3.5 w-3.5 text-emerald-500" />
            Filters:
          </span>
          {parsedTokens.map((tag, idx) => (
            <span
              key={idx}
              className="inline-flex items-center rounded-full border border-emerald-100 bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-700"
            >
              {tag}
            </span>
          ))}
        </div>
      )}

      <div className="mt-3 flex flex-nowrap items-center gap-2 overflow-x-auto pb-1 scrollbar-none">
        <FilterBottomSheet
          currentFilters={currentFilters}
          onApply={onMobileApply}
          mode="all"
          trigger={
            <button
              type="button"
              style={{ touchAction: 'manipulation' }}
              className="inline-flex min-h-11 shrink-0 items-center gap-1.5 rounded-full bg-emerald-500 px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-emerald-600 active:scale-[0.98]"
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
        <FilterBottomSheet
          currentFilters={currentFilters}
          onApply={onPriceApply}
          mode="price"
          trigger={
            <button
              type="button"
              style={{ touchAction: 'manipulation' }}
              className="inline-flex min-h-11 shrink-0 items-center gap-1.5 rounded-full bg-rose-500 px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-rose-600 active:scale-[0.98]"
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
            onClick={onBookTour}
            style={{ touchAction: 'manipulation' }}
            className="inline-flex min-h-11 shrink-0 items-center gap-1.5 rounded-full bg-slate-900 px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-slate-800 active:scale-[0.98]"
          >
            <CalendarCheck className="h-3.5 w-3.5" />
            Book a Tour
          </button>
        )}
      </div>

      {activeFilterCount > 0 && (
        <div className="mt-3">
          <ActiveFilterChips
            filters={currentFilters}
            onRemoveGender={(v) => setGenders(genders.filter((g) => g !== v))}
            onRemoveAmenity={(v) => setAmenities(amenities.filter((a) => a !== v))}
            onRemoveRoomType={(v) => setRoomTypes(roomTypes.filter((r) => r !== v))}
            onRemovePrice={() => setPriceRange(null, null)}
            onRemoveZone={(v) => setZones(zones.filter((z) => z !== v))}
            onRemoveMaxDistance={() => setMaxDistance(null)}
            onRemoveSortByNearest={() => setSortByNearest(false)}
            onClearAll={reset}
          />
        </div>
      )}
    </>
  );
}

export function NavbarSearch() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const isHostelsPage = pathname === '/hostels' || pathname.startsWith('/hostels/');
  const isBnbPage = pathname === '/bnb' || pathname.startsWith('/bnb/');

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

  const qFromUrl = searchParams.get('q') ?? '';
  const [isOpen, setIsOpen] = React.useState(false);
  const [query, setQuery] = React.useState(qFromUrl);
  const [results, setResults] = React.useState<Listing[]>([]);
  const [totalCount, setTotalCount] = React.useState(0);
  const [isLoading, setIsLoading] = React.useState(false);
  const [showSpinner, setShowSpinner] = React.useState(false);
  const [selectedIndex, setSelectedIndex] = React.useState(-1);
  const [isLoggedIn, setIsLoggedIn] = React.useState(false);
  const [isMobile, setIsMobile] = React.useState(false);

  const debouncedQuery = useDebounce(query, 120);

  const containerRef = React.useRef<HTMLDivElement>(null);
  const panelRef = React.useRef<HTMLDivElement>(null);
  const desktopPanelRef = React.useRef<HTMLDivElement>(null);
  const inputRef = React.useRef<HTMLInputElement>(null);
  const desktopInputRef = React.useRef<HTMLInputElement>(null);
  const triggerRef = React.useRef<HTMLButtonElement>(null);
  const isTypingRef = React.useRef(false);

  const activePanelRef = isMobile ? panelRef : desktopPanelRef;
  const activeInputRef = isMobile ? inputRef : desktopInputRef;
  useFocusTrap(activePanelRef, isOpen);

  React.useEffect(() => {
    if (typeof window.matchMedia !== 'function') {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setIsMobile(true);
      return;
    }
    const mq = window.matchMedia('(max-width: 767px)');
    setIsMobile(mq.matches);
    const handler = (e: MediaQueryListEvent) => setIsMobile(e.matches);
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, []);

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

  React.useEffect(() => {
    const curInput = activeInputRef.current;
    if (isTypingRef.current && document.activeElement === curInput) return;
    if (qFromUrl !== query) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setQuery(qFromUrl);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [qFromUrl]);

  React.useEffect(() => {
    if (isOpen) {
      const id = setTimeout(() => activeInputRef.current?.focus(), 60);
      return () => clearTimeout(id);
    }
  }, [isOpen, isMobile, activeInputRef]);

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

  React.useEffect(() => {
    if (!isOpen) return;
    const handleMouseDown = (e: MouseEvent) => {
      const target = e.target as Node;
      const panel = activePanelRef.current;
      if (
        containerRef.current &&
        !containerRef.current.contains(target) &&
        panel &&
        !panel.contains(target)
      ) {
        setIsOpen(false);
      }
    };
    const handleTouchStart = (e: TouchEvent) => {
      const target = e.target as Node;
      const panel = activePanelRef.current;
      if (
        containerRef.current &&
        !containerRef.current.contains(target) &&
        panel &&
        !panel.contains(target)
      ) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleMouseDown);
    document.addEventListener('touchstart', handleTouchStart, { passive: true });
    return () => {
      document.removeEventListener('mousedown', handleMouseDown);
      document.removeEventListener('touchstart', handleTouchStart);
    };
  }, [isOpen, activePanelRef]);

  React.useEffect(() => {
    if (!isHostelsPage) return;
    const trimmed = debouncedQuery.trim();
    const currentQ = searchParams.get('q') ?? '';
    if (trimmed === currentQ) return;
    const params = new URLSearchParams(searchParams.toString());
    if (trimmed) params.set('q', trimmed);
    else params.delete('q');
    router.replace(`${pathname}?${params.toString()}`, { scroll: false });
  }, [debouncedQuery, isHostelsPage, pathname, router, searchParams]);

  React.useEffect(() => {
    if (!isLoading) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setShowSpinner(false);
      return;
    }
    const id = setTimeout(() => setShowSpinner(true), 250);
    return () => clearTimeout(id);
  }, [isLoading]);

  React.useEffect(() => {
    if (isHostelsPage) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
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
    const controller = new AbortController();
    setIsLoading(true);
    searchApi
      .search({ q: trimmed, limit: 5 })
      .then((res) => {
        if (!active) return;
        setResults(res.items?.slice(0, 5) || []);
        setTotalCount(res.total || 0);
      })
      .catch(() => {
        if (!active) return;
        setResults([]);
        setTotalCount(0);
      })
      .finally(() => {
        if (active) setIsLoading(false);
      });
    return () => {
      active = false;
      controller.abort();
    };
  }, [debouncedQuery, isHostelsPage]);

  const parsedTokens = React.useMemo(() => {
    if (!query.trim()) return [];
    const parsed = parseQuery(query);
    const tags: string[] = [];
    if (parsed.gender) tags.push(parsed.gender === 'female' ? 'Ladies' : 'Gents');
    if (parsed.roomType) tags.push(parsed.roomType.replace(/_/g, ' '));
    if (parsed.maxPrice) tags.push(`Under KES ${parsed.maxPrice.toLocaleString()}`);
    if (parsed.minPrice) tags.push(`From KES ${parsed.minPrice.toLocaleString()}`);
    if (parsed.area) tags.push(parsed.area);
    if (parsed.amenities.length > 0) tags.push(...parsed.amenities);
    return tags;
  }, [query]);

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
  const shouldShowAutocomplete = !isHostelsPage && isOpen && debouncedQuery.trim().length >= 2;

  const handleOpen = () => setIsOpen(true);
  const handleClose = () => {
    setIsOpen(false);
    triggerRef.current?.focus();
  };

  const buildFilterParamsFromDraft = (draft: FilterState) => {
    const p = new URLSearchParams();
    if (draft.genders.length) p.set('gender', draft.genders.join(','));
    if (draft.amenities.length) p.set('amenities', draft.amenities.join(','));
    if (draft.roomTypes.length) p.set('roomType', draft.roomTypes.join(','));
    if (draft.minPrice !== null) p.set('minPrice', String(draft.minPrice));
    if (draft.maxPrice !== null) p.set('maxPrice', String(draft.maxPrice));
    if (draft.zones.length) p.set('zone', draft.zones.join(','));
    if (draft.maxDistance !== null) p.set('maxDistance', String(draft.maxDistance));
    if (draft.sortByNearest) p.set('sortByNearest', 'true');
    return p;
  };

  const handleSearchSubmit = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const trimmed = query.trim();
    if (selectedIndex >= 0 && selectedIndex < results.length) {
      const selected = results[selectedIndex];
      const targetUrl = selected.slug
        ? `${listingPath(selected)}`
        : `/listing/${selected.id}`;
      router.push(targetUrl);
      handleClose();
      return;
    }
    if (isHostelsPage) {
      const params = new URLSearchParams(searchParams.toString());
      if (trimmed) params.set('q', trimmed);
      else params.delete('q');
      router.replace(`${pathname}${params.toString() ? `?${params.toString()}` : ''}`, { scroll: false });
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
    isTypingRef.current = true;
    setQuery('');
    setResults([]);
    setSelectedIndex(-1);
    if (isHostelsPage) {
      const params = new URLSearchParams(searchParams.toString());
      params.delete('q');
      router.replace(`${pathname}${params.toString() ? `?${params.toString()}` : ''}`, { scroll: false });
    }
    setTimeout(() => {
      isTypingRef.current = false;
    }, 300);
    activeInputRef.current?.focus();
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
    if (!isHostelsPage) {
      const filterParams = buildFilterParamsFromDraft(draft);
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
      const merged: FilterState = {
        genders,
        amenities,
        roomTypes,
        minPrice: draft.minPrice,
        maxPrice: draft.maxPrice,
        zones,
        maxDistance,
        sortByNearest,
      };
      const filterParams = buildFilterParamsFromDraft(merged);
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

  const cardProps = {
    query,
    setQuery,
    isTypingRef,
    setSelectedIndex,
    isLoading,
    showSpinner,
    onClear: handleClear,
    onKeyDown: handleQueryKeyDown,
    onSubmit: handleSearchSubmit,
    parsedTokens,
    currentFilters,
    activeFilterCount,
    priceFilterActive,
    isBnbPage,
    onBookTour: handleBookTour,
    onMobileApply: handleMobileApply,
    onPriceApply: handlePriceApply,
    setGenders,
    setAmenities,
    setRoomTypes,
    setPriceRange,
    setZones,
    setMaxDistance,
    setSortByNearest,
    genders,
    amenities,
    roomTypes,
    zones,
    reset,
    shouldShowAutocomplete,
  };

  return (
    <div ref={containerRef} className="relative w-full max-w-[420px]">
      <AnimatePresence initial={false}>
        {!isOpen && (
          <motion.div
            key="pill"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.14 }}
          >
            <IdleSearchPill
              query={query}
              activeFilterCount={activeFilterCount}
              isExpanded={isOpen}
              isBnbPage={isBnbPage}
              onActivate={handleOpen}
              triggerRef={triggerRef}
            />
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {isOpen && (
          <>
            <motion.div
              key="backdrop"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.16 }}
              aria-hidden="true"
              onClick={handleClose}
              className="fixed inset-0 z-40 bg-slate-900/15 backdrop-blur-[1px]"
            />

            {isMobile ? (
              <motion.div
                key="panel-mobile"
                ref={panelRef}
                id="navbar-search-panel"
                role="dialog"
                aria-label={isBnbPage ? 'Search stays' : 'Search hostels'}
                aria-modal="true"
                initial={{ opacity: 0, y: -8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
                className="fixed inset-x-0 top-[56px] z-50 max-h-[calc(100dvh-56px)] overflow-y-auto border-b border-slate-200 bg-white shadow-[0_16px_40px_rgba(15,23,42,0.10)]"
              >
                <div className="mx-auto max-w-6xl px-4 py-4">
                  <div className="rounded-2xl border border-slate-100 bg-white p-3 shadow-[0_1px_14px_rgba(0,0,0,0.06)]">
                    <SearchCardContent {...cardProps} inputRef={inputRef} />
                  </div>
                  {shouldShowAutocomplete && (
                    <div className="mt-3 overflow-hidden rounded-2xl border border-slate-100 bg-white shadow-sm">
                      <AutocompleteList
                        results={results}
                        selectedIndex={selectedIndex}
                        query={query}
                        totalCount={totalCount}
                        isLoading={isLoading}
                        isBnbPage={isBnbPage}
                        onSelect={handleClose}
                        onViewAll={() => handleSearchSubmit()}
                      />
                    </div>
                  )}
                  <div className="mt-3 flex justify-center">
                    <button
                      type="button"
                      onClick={handleClose}
                      className="rounded-full px-4 py-2 text-xs font-semibold text-slate-500 hover:bg-slate-100"
                    >
                      Close
                    </button>
                  </div>
                </div>
              </motion.div>
            ) : (
              <motion.div
                key="panel-desktop"
                ref={desktopPanelRef}
                id="navbar-search-panel"
                role="dialog"
                aria-label={isBnbPage ? 'Search stays' : 'Search hostels'}
                aria-modal="true"
                initial={{ opacity: 0, y: -6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -6 }}
                transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
                className="fixed inset-x-0 top-0 z-[60] border-b border-slate-200 bg-white shadow-[0_8px_30px_rgba(15,23,42,0.08)]"
              >
                <div className="mx-auto flex min-h-[56px] max-w-6xl items-start gap-3 px-4 py-3 lg:px-8">
                  <Link
                    href="/"
                    aria-label="Rumia Home"
                    onClick={handleClose}
                    className="hidden shrink-0 items-center gap-2 py-1 lg:flex"
                  >
                    <span className="flex h-8 w-8 items-center justify-center overflow-hidden rounded-xl bg-emerald-50 ring-1 ring-emerald-100">
                      <Image src="/images/logo/logo-icon.svg" alt="Rumia" width={20} height={20} className="h-5 w-5 object-contain" />
                    </span>
                    <span className="font-heading text-[17px] font-extrabold tracking-tight text-slate-900">Rumia</span>
                  </Link>

                  <div className="min-w-0 flex-1 px-2 lg:px-6">
                    <div className="mx-auto max-w-[640px] rounded-2xl border border-slate-100 bg-white p-3 shadow-[0_1px_14px_rgba(0,0,0,0.06)] sm:p-4">
                      <SearchCardContent {...cardProps} inputRef={desktopInputRef} />
                    </div>
                    {shouldShowAutocomplete && (
                      <div className="mx-auto mt-3 max-w-[640px] overflow-hidden rounded-2xl border border-slate-100 bg-white shadow-[0_1px_14px_rgba(0,0,0,0.06)]">
                        <AutocompleteList
                          results={results}
                          selectedIndex={selectedIndex}
                          query={query}
                          totalCount={totalCount}
                          isLoading={isLoading}
                          isBnbPage={isBnbPage}
                          onSelect={handleClose}
                          onViewAll={() => handleSearchSubmit()}
                        />
                      </div>
                    )}
                  </div>

                  <button
                    type="button"
                    onClick={handleClose}
                    aria-label="Close search"
                    style={{ touchAction: 'manipulation' }}
                    className="hidden h-9 w-9 shrink-0 items-center justify-center rounded-full bg-slate-100 text-slate-600 hover:bg-slate-200 lg:inline-flex"
                  >
                    <X className="h-4 w-4" />
                  </button>
                  <button
                    type="button"
                    onClick={handleClose}
                    aria-label="Close search"
                    className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-slate-100 text-slate-600 hover:bg-slate-200 lg:hidden"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              </motion.div>
            )}
          </>
        )}
      </AnimatePresence>
    </div>
  );
}

function AutocompleteList({
  results,
  selectedIndex,
  query,
  totalCount,
  isLoading,
  isBnbPage,
  onSelect,
  onViewAll,
}: {
  results: Listing[];
  selectedIndex: number;
  query: string;
  totalCount: number;
  isLoading: boolean;
  isBnbPage: boolean;
  onSelect: () => void;
  onViewAll: () => void;
}) {
  return (
    <>
      <ul id="navbar-autocomplete-list" role="listbox" className="max-h-[340px] divide-y divide-slate-100 overflow-y-auto py-1">
        {results.length > 0 ? (
          results.map((item, idx) => {
            const isSelected = selectedIndex === idx;
            const firstImage = item.images?.[0]?.r2_url;
            const href = item.slug
              ? `${listingPath(item)}`
              : `/listing/${item.id}`;
            const priceText = item.price_single
              ? `KES ${item.price_single.toLocaleString()}/mo`
              : `KES ${item.price?.toLocaleString()}/mo`;
            return (
              <li key={item.id} role="option" aria-selected={isSelected}>
                <Link
                  href={href}
                  onClick={onSelect}
                  className={`flex items-center gap-3 px-4 py-3 transition-colors ${isSelected ? 'bg-emerald-50' : 'hover:bg-slate-50'}`}
                >
                  <div className="relative h-11 w-11 shrink-0 overflow-hidden rounded-xl border border-slate-100 bg-slate-100">
                    {firstImage ? (
                      <Image
                        src={firstImage}
                        alt={item.title}
                        fill
                        className="object-cover"
                        sizes="44px"
                        placeholder="blur"
                        blurDataURL={item.images?.[0]?.blur_data_url || FALLBACK_BLUR}
                      />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center text-slate-400">
                        <Search className="h-4 w-4" />
                      </div>
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-2">
                      <p className="truncate text-sm font-bold text-slate-900">{item.title}</p>
                      <span className="shrink-0 text-xs font-extrabold text-emerald-600">{priceText}</span>
                    </div>
                    <div className="mt-0.5 flex items-center gap-1.5 text-xs font-medium text-slate-500">
                      <MapPin className="h-3 w-3 shrink-0 text-slate-400" />
                      <span className="truncate">
                        {item.area || item.location || 'Nyeri'}
                        {item.specific_location ? ` · ${item.specific_location}` : ''}
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
          <li role="option" aria-selected={false} className="px-4 py-8 text-center">
            <p className="text-sm font-semibold text-slate-600">
              {isBnbPage ? `No stays found for "${query}"` : `No hostels found for "${query}"`}
            </p>
            <p className="mt-1 text-xs text-slate-400">Try a different area or room type.</p>
          </li>
        ) : (
          <li className="flex items-center justify-center py-8">
            <Loader2 className="h-5 w-5 animate-spin text-emerald-600" />
          </li>
        )}
      </ul>
      <div className="border-t border-slate-100 bg-slate-50/80 px-4 py-2.5">
        <button
          type="button"
          onClick={onViewAll}
          style={{ touchAction: 'manipulation' }}
          className="flex w-full items-center justify-between rounded-xl px-3 py-2 text-sm font-bold text-emerald-700 transition-colors hover:bg-emerald-50"
        >
          <span>
            {totalCount > 0
              ? `View all ${totalCount} results`
              : isBnbPage
                ? `Search all stays for "${query}"`
                : `Search all hostels for "${query}"`}
          </span>
          <ArrowRight className="h-4 w-4" />
        </button>
      </div>
    </>
  );
}
