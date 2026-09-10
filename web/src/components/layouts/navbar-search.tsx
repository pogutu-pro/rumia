'use client';

import * as React from 'react';
import { useRouter, usePathname, useSearchParams } from 'next/navigation';
import Image from 'next/image';
import Link from 'next/link';
import { Search, X, Loader2, ArrowRight, MapPin, Sparkles } from 'lucide-react';
import { useDebounce } from '@/hooks/use-debounce';
import { searchApi } from '@/lib/api/search';
import { parseQuery } from '@/lib/search/parse-query';
import type { Listing } from '@/types';

const FALLBACK_BLUR =
  'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCA2MDAgNDUwIj48cmVjdCB3aWR0aD0iNjAwIiBoZWlnaHQ9IjQ1MCIgZmlsbD0iI2UyZThmMCIvPjwvc3ZnPg==';

export function NavbarSearch() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const isHostelsPage =
    pathname === '/hostels' || pathname.startsWith('/hostels/');

  const qFromUrl = searchParams.get('q') ?? '';
  const [query, setQuery] = React.useState(qFromUrl);
  const debouncedQuery = useDebounce(query, 250);

  const [results, setResults] = React.useState<Listing[]>([]);
  const [totalCount, setTotalCount] = React.useState(0);
  const [isLoading, setIsLoading] = React.useState(false);
  const [isOpen, setIsOpen] = React.useState(false);
  const [selectedIndex, setSelectedIndex] = React.useState<number>(-1);

  const containerRef = React.useRef<HTMLDivElement>(null);
  const inputRef = React.useRef<HTMLInputElement>(null);

  // Sync input value whenever URL query changes (e.g. from page search input or navigation)
  React.useEffect(() => {
    setQuery(qFromUrl);
  }, [qFromUrl]);

  // Live filter on /hostels page: when typing on /hostels, sync URL so the page filters in real time
  React.useEffect(() => {
    if (!isHostelsPage) return;

    const trimmed = debouncedQuery.trim();
    const currentQ = searchParams.get('q') ?? '';

    if (trimmed !== currentQ) {
      const params = new URLSearchParams(searchParams.toString());
      if (trimmed) {
        params.set('q', trimmed);
      } else {
        params.delete('q');
      }
      const newUrl = `${pathname}${params.toString() ? `?${params.toString()}` : ''}`;
      router.replace(newUrl, { scroll: false });
    }
  }, [debouncedQuery, isHostelsPage, pathname, router, searchParams]);

  // Live preview dropdown on non-/hostels pages
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
        setResults(res.items || []);
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

  // Close dropdown on outside click
  React.useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        containerRef.current &&
        !containerRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

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

  const handleSearchSubmit = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setIsOpen(false);
    inputRef.current?.blur();

    const trimmed = query.trim();
    if (selectedIndex >= 0 && selectedIndex < results.length) {
      const selected = results[selectedIndex];
      const targetUrl = selected.slug
        ? `/hostels/${selected.county || 'nyeri'}/${selected.area || 'dekut'}/${selected.slug}`
        : `/listing/${selected.id}`;
      router.push(targetUrl);
      return;
    }

    if (isHostelsPage) {
      const params = new URLSearchParams(searchParams.toString());
      if (trimmed) {
        params.set('q', trimmed);
      } else {
        params.delete('q');
      }
      const newUrl = `${pathname}${params.toString() ? `?${params.toString()}` : ''}`;
      router.replace(newUrl, { scroll: false });
      return;
    }

    if (trimmed) {
      router.push(`/hostels?q=${encodeURIComponent(trimmed)}`);
    } else {
      router.push('/hostels');
    }
  };

  const handleClear = () => {
    setQuery('');
    setResults([]);
    setIsOpen(false);
    if (isHostelsPage) {
      const params = new URLSearchParams(searchParams.toString());
      params.delete('q');
      const newUrl = `${pathname}${params.toString() ? `?${params.toString()}` : ''}`;
      router.replace(newUrl, { scroll: false });
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!isOpen) {
      if (e.key === 'ArrowDown') {
        setIsOpen(true);
      }
      return;
    }

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex((prev) => (prev < results.length ? prev + 1 : prev));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex((prev) => (prev > -1 ? prev - 1 : -1));
    } else if (e.key === 'Escape') {
      setIsOpen(false);
    } else if (e.key === 'Enter') {
      e.preventDefault();
      handleSearchSubmit();
    }
  };

  const shouldShowDropdown =
    !isHostelsPage && isOpen && query.trim().length >= 2;

  return (
    <div ref={containerRef} className="relative w-full max-w-[200px] xs:max-w-[260px] sm:max-w-sm md:max-w-md">
      <form onSubmit={handleSearchSubmit} role="search" className="relative w-full">
        <Search className="pointer-events-none absolute left-2.5 xs:left-3 top-1/2 h-3.5 w-3.5 xs:h-4 xs:w-4 -translate-y-1/2 text-slate-400" />
        <input
          ref={inputRef}
          type="search"
          value={query}
          onFocus={() => {
            if (!isHostelsPage && query.trim().length >= 2) {
              setIsOpen(true);
            }
          }}
          onChange={(e) => {
            setQuery(e.target.value);
            if (!isHostelsPage && e.target.value.trim().length >= 2) {
              setIsOpen(true);
            }
          }}
          onKeyDown={handleKeyDown}
          placeholder="Search hostels, bedsitters, areas..."
          enterKeyHint="search"
          autoComplete="off"
          className="h-9 xs:h-9.5 sm:h-10 w-full rounded-full border border-slate-200 bg-slate-50/90 pl-8 xs:pl-9 pr-7 xs:pr-8 text-xs xs:text-sm font-medium text-slate-900 placeholder:text-slate-400 transition-all duration-200 hover:border-slate-300 hover:bg-white focus:border-emerald-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20 touch-manipulation"
        />

        {isLoading ? (
          <Loader2 className="absolute right-2 xs:right-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 animate-spin text-emerald-600 pointer-events-none" />
        ) : query ? (
          <button
            type="button"
            onClick={handleClear}
            aria-label="Clear search query"
            className="absolute right-2 xs:right-2.5 top-1/2 -translate-y-1/2 rounded-full p-1 text-slate-400 hover:text-slate-600 touch-manipulation cursor-pointer"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        ) : null}
      </form>

      {/* Floating Autocomplete / Quick Search Dropdown */}
      {shouldShowDropdown && (
        <div className="absolute left-0 right-0 top-full mt-2 z-50 overflow-hidden rounded-2xl border border-slate-200/80 bg-white/95 backdrop-blur-md shadow-xl transition-all duration-200 animate-in fade-in-0 zoom-in-95">
          {/* Quick Filter Tag Badges if NLP matched intent */}
          {parsedTokens.length > 0 && (
            <div className="flex flex-wrap items-center gap-1.5 px-3.5 py-2.5 bg-slate-50 border-b border-slate-100">
              <span className="flex items-center gap-1 text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                <Sparkles className="h-3 w-3 text-emerald-600" /> Filters:
              </span>
              {parsedTokens.map((tag, idx) => (
                <span
                  key={idx}
                  className="inline-flex items-center rounded-md bg-emerald-50 px-2 py-0.5 text-xs font-semibold text-emerald-700 border border-emerald-100"
                >
                  {tag}
                </span>
              ))}
            </div>
          )}

          {/* Results List */}
          <div className="max-h-[340px] overflow-y-auto py-1 divide-y divide-slate-100/60">
            {results.length > 0 ? (
              results.map((item, idx) => {
                const isSelected = selectedIndex === idx;
                const images = item.images || [];
                const firstImage = images[0]?.r2_url;
                const href = item.slug
                  ? `/hostels/${item.county || 'nyeri'}/${item.area || 'dekut'}/${item.slug}`
                  : `/listing/${item.id}`;

                let priceText = `KES ${item.price?.toLocaleString()}/mo`;
                if (item.price_single) {
                  priceText = `KES ${item.price_single.toLocaleString()}/mo`;
                }

                return (
                  <Link
                    key={item.id}
                    href={href}
                    onClick={() => setIsOpen(false)}
                    className={`flex items-center gap-3 px-3.5 py-2.5 transition-colors ${
                      isSelected
                        ? 'bg-emerald-50/80 text-emerald-950'
                        : 'hover:bg-slate-50 text-slate-900'
                    }`}
                  >
                    <div className="relative h-11 w-11 shrink-0 overflow-hidden rounded-lg bg-slate-100 border border-slate-100">
                      {firstImage ? (
                        <Image
                          src={firstImage}
                          alt={item.title}
                          fill
                          className="object-cover"
                          sizes="44px"
                          placeholder="blur"
                          blurDataURL={images[0]?.blur_data_url || FALLBACK_BLUR}
                        />
                      ) : (
                        <div className="flex h-full w-full items-center justify-center bg-slate-100 text-slate-400">
                          <Search className="h-4 w-4" />
                        </div>
                      )}
                    </div>

                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-2">
                        <p className="truncate text-xs sm:text-sm font-bold text-slate-900">
                          {item.title}
                        </p>
                        <span className="shrink-0 text-xs font-extrabold text-emerald-600">
                          {priceText}
                        </span>
                      </div>
                      <div className="flex items-center gap-1.5 mt-0.5 text-[11px] text-slate-500 font-medium">
                        <MapPin className="h-3 w-3 shrink-0 text-slate-400" />
                        <span className="truncate">
                          {item.area || item.location || 'Nyeri'}
                          {item.specific_location ? ` · ${item.specific_location}` : ''}
                        </span>
                        {item.room_type && (
                          <span className="shrink-0 rounded bg-slate-100 px-1.5 py-0.2 text-[10px] font-semibold text-slate-600">
                            {item.room_type}
                          </span>
                        )}
                      </div>
                    </div>
                  </Link>
                );
              })
            ) : !isLoading ? (
              <div className="px-4 py-6 text-center">
                <p className="text-xs font-semibold text-slate-600">
                  No hostels found matching &quot;{query}&quot;
                </p>
                <p className="mt-1 text-[11px] text-slate-400">
                  Try checking your spelling or search by area/room type.
                </p>
              </div>
            ) : null}
          </div>

          {/* Footer: View all on /hostels */}
          <div className="border-t border-slate-100 bg-slate-50/80 px-3.5 py-2">
            <button
              type="button"
              onClick={() => handleSearchSubmit()}
              className={`flex w-full items-center justify-between rounded-xl px-2.5 py-1.5 text-xs font-bold transition-colors cursor-pointer ${
                selectedIndex === results.length
                  ? 'bg-emerald-600 text-white'
                  : 'text-emerald-700 hover:bg-emerald-100/70'
              }`}
            >
              <span>
                {totalCount > 0
                  ? `View all ${totalCount} results on Search page`
                  : `Search all hostels for "${query}"`}
              </span>
              <ArrowRight className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
