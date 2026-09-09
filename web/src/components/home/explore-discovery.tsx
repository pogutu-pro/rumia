'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { ArrowRight, BedDouble, Building2, LayoutGrid, MapPin, Moon } from 'lucide-react';
import { cn } from '@/lib/utils/cn';
import {
  ExploreListingCard,
  type ExploreListing,
} from './explore-listing-card';

export interface ExploreZone {
  name: string;
  slug?: string;
  count?: number;
}

type CategoryKey = 'all' | 'hostel' | 'apartment' | 'short_stay';

const CATEGORIES: {
  key: CategoryKey;
  label: string;
  Icon: typeof BedDouble;
}[] = [
  { key: 'all', label: 'All', Icon: LayoutGrid },
  { key: 'hostel', label: 'Hostels', Icon: BedDouble },
  { key: 'apartment', label: 'Apartments', Icon: Building2 },
  { key: 'short_stay', label: 'Short stays', Icon: Moon },
];

interface ExploreDiscoveryProps {
  items: ExploreListing[];
  zones?: ExploreZone[];
  city?: string;
  campusName?: string;
}

export function ExploreDiscovery({
  items,
  zones = [],
  city = 'Nyeri',
  campusName = 'Dedan Kimathi',
}: ExploreDiscoveryProps) {
  const [category, setCategory] = useState<CategoryKey>('all');
  const [selectedZone, setSelectedZone] = useState<string | null>(null);

  // Filter listings by property type AND zone
  const filtered = useMemo(() => {
    let result = items;

    if (category !== 'all') {
      result = result.filter(
        (item) => (item.property_type ?? 'hostel') === category,
      );
    }

    if (selectedZone) {
      const target = selectedZone.toLowerCase().trim();
      result = result.filter((item) => {
        const area = (item.area ?? '').toLowerCase().trim();
        const loc = (item.location ?? '').toLowerCase().trim();
        return area === target || loc.includes(target) || area.includes(target);
      });
    }

    return result;
  }, [items, category, selectedZone]);

  const categoryLabel = useMemo(() => {
    switch (category) {
      case 'hostel':
        return 'Hostels';
      case 'apartment':
        return 'Apartments';
      case 'short_stay':
        return 'Short stays';
      case 'all':
      default:
        return 'Places';
    }
  }, [category]);

  const sectionTitle = useMemo(() => {
    if (selectedZone) {
      return `${categoryLabel} in ${selectedZone}`;
    }
    return `${categoryLabel} near ${campusName}`;
  }, [categoryLabel, selectedZone, campusName]);

  const sectionSubtitle = useMemo(() => {
    if (selectedZone) {
      return `Verified options located in ${selectedZone}`;
    }
    switch (category) {
      case 'hostel':
        return 'Student-friendly hostels & rooms';
      case 'apartment':
        return 'Self-contained units for monthly stays';
      case 'short_stay':
        return 'Furnished stays for short visits';
      case 'all':
      default:
        return `Browse verified accommodation around ${campusName}`;
    }
  }, [selectedZone, category, campusName]);

  const seeAllHref = useMemo(() => {
    const params = new URLSearchParams();
    if (selectedZone) {
      params.set('zone', selectedZone);
    }
    if (category !== 'all') {
      params.set('type', category);
    }
    const qs = params.toString();
    return qs ? `/hostels?${qs}` : '/hostels';
  }, [selectedZone, category]);

  return (
    <section className="mx-auto w-full max-w-6xl px-4 pt-3 sm:pt-4 lg:px-8">
      {/* 1. PROPERTY TYPE NAVIGATION (WHAT) */}
      <div className="scrollbar-none -mx-4 flex flex-nowrap items-center gap-2 overflow-x-auto px-4 sm:mx-0 sm:px-0 overscroll-x-contain touch-pan-x">
        {CATEGORIES.map(({ key, label, Icon }) => {
          const active = category === key;
          return (
            <button
              key={key}
              type="button"
              onClick={() => setCategory(key)}
              aria-pressed={active}
              className={cn(
                'inline-flex shrink-0 cursor-pointer items-center gap-2 rounded-xl px-3.5 py-2 text-xs sm:text-sm font-bold transition-all duration-200 touch-manipulation active:scale-95',
                active
                  ? 'border border-emerald-600/80 bg-emerald-50 text-emerald-800 shadow-xs ring-1 ring-emerald-600/30'
                  : 'border border-slate-200/80 bg-white text-slate-600 hover:border-slate-300 hover:bg-slate-50 hover:text-slate-900',
              )}
            >
              <Icon
                className={cn(
                  'h-4 w-4 transition-colors',
                  active ? 'text-emerald-700' : 'text-slate-400',
                )}
                strokeWidth={2.25}
              />
              <span>{label}</span>
            </button>
          );
        })}
      </div>

      {/* 2. ZONE DISCOVERY ROW (WHERE) */}
      {zones.length > 0 && (
        <div className="mt-3.5 sm:mt-5 pt-3 border-t border-slate-100">
          <div className="flex items-center justify-between gap-2 mb-2">
            <div className="flex items-center gap-1.5 text-xs font-bold text-slate-700">
              <MapPin className="h-3.5 w-3.5 text-emerald-600" />
              <span>Explore around {campusName}</span>
            </div>
            {selectedZone && (
              <button
                type="button"
                onClick={() => setSelectedZone(null)}
                className="text-[11px] font-semibold text-emerald-700 hover:underline cursor-pointer touch-manipulation"
              >
                Reset area
              </button>
            )}
          </div>

          <div className="scrollbar-none -mx-4 flex flex-nowrap items-center gap-1.5 overflow-x-auto px-4 sm:mx-0 sm:px-0 py-0.5 overscroll-x-contain touch-pan-x">
            <button
              type="button"
              onClick={() => setSelectedZone(null)}
              aria-pressed={selectedZone === null}
              className={cn(
                'inline-flex shrink-0 cursor-pointer items-center rounded-full px-3 py-1.5 text-xs font-semibold transition-all duration-150 touch-manipulation active:scale-95',
                selectedZone === null
                  ? 'bg-slate-900 text-white shadow-xs'
                  : 'bg-slate-100/90 text-slate-600 hover:bg-slate-200 hover:text-slate-900',
              )}
            >
              All areas
            </button>
            {zones.map((zone) => {
              const active = selectedZone === zone.name;
              return (
                <button
                  key={zone.name}
                  type="button"
                  onClick={() =>
                    setSelectedZone(active ? null : zone.name)
                  }
                  aria-pressed={active}
                  className={cn(
                    'inline-flex shrink-0 cursor-pointer items-center gap-1 rounded-full px-3 py-1.5 text-xs font-semibold transition-all duration-150 touch-manipulation active:scale-95',
                    active
                      ? 'bg-emerald-600 text-white shadow-xs'
                      : 'bg-slate-100/90 text-slate-600 hover:bg-slate-200 hover:text-slate-900',
                  )}
                >
                  <span>{zone.name}</span>
                  {typeof zone.count === 'number' && zone.count > 0 && (
                    <span
                      className={cn(
                        'text-[10px] opacity-75 font-normal',
                        active ? 'text-white' : 'text-slate-400',
                      )}
                    >
                      ({zone.count})
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* 3. IMMEDIATE DISCOVERY RAIL */}
      <div className="mt-4 sm:mt-6">
        <div className="mb-2.5 sm:mb-3.5 flex items-baseline justify-between gap-3">
          <div className="min-w-0 flex-1">
            <h2 className="text-base font-extrabold tracking-tight text-slate-900 xs:text-lg sm:text-xl truncate">
              {sectionTitle}
            </h2>
            <p className="mt-0.5 text-xs sm:text-sm font-medium text-slate-500 truncate">
              {sectionSubtitle}
            </p>
          </div>
          <Link
            href={seeAllHref}
            className="inline-flex shrink-0 items-center gap-1 py-1 px-1 -mr-1 text-xs sm:text-sm font-semibold text-emerald-700 transition-colors hover:text-emerald-800 touch-manipulation"
          >
            See all
            <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </div>

        {filtered.length > 0 ? (
          <div className="scrollbar-hide -mx-4 flex snap-x snap-mandatory gap-3 overflow-x-auto px-4 py-1 pb-2.5 sm:mx-0 sm:gap-4 sm:px-0 overscroll-x-contain touch-pan-x">
            {filtered.map((item) => (
              <ExploreListingCard key={item.id} item={item} />
            ))}
          </div>
        ) : (
          <div className="rounded-2xl border border-slate-100 bg-slate-50/60 p-6 text-center sm:p-8">
            <p className="text-xs sm:text-sm font-medium text-slate-500">
              No {categoryLabel.toLowerCase()} found in{' '}
              <span className="font-bold text-slate-700">{selectedZone}</span> right now.
            </p>
            <div className="mt-3 flex items-center justify-center gap-2">
              <button
                type="button"
                onClick={() => setSelectedZone(null)}
                className="cursor-pointer rounded-xl bg-white px-3.5 py-1.5 text-xs font-bold text-slate-700 shadow-xs ring-1 ring-slate-200 hover:bg-slate-50 transition-colors"
              >
                Show all areas
              </button>
              <button
                type="button"
                onClick={() => setCategory('all')}
                className="cursor-pointer rounded-xl bg-emerald-600 px-3.5 py-1.5 text-xs font-bold text-white shadow-xs hover:bg-emerald-700 transition-colors"
              >
                Show all property types
              </button>
            </div>
          </div>
        )}
      </div>
    </section>
  );
}