'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ArrowRight, BedDouble, Building2, House, MapPin } from 'lucide-react';
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

type CategoryKey = 'hostel' | 'short_stay' | 'apartment';

const CATEGORIES: {
  key: CategoryKey;
  label: string;
  Icon: typeof BedDouble;
}[] = [
  { key: 'hostel', label: 'Hostels', Icon: BedDouble },
  { key: 'short_stay', label: 'RumiaBnB', Icon: House },
  { key: 'apartment', label: 'Apartments', Icon: Building2 },
];

interface ExploreDiscoveryProps {
  items: ExploreListing[];
  zones?: ExploreZone[];
  city?: string;
  campus?: { name: string; short_name: string | null } | null;
  campusName?: string;
}

function ResponsiveCampusName({
  campus,
}: {
  campus: { name: string; short_name: string | null } | null | undefined;
}) {
  const full = campus?.name ?? campus?.short_name ?? '';
  const short =
    campus?.short_name ??
    (full === 'Dedan Kimathi University of Technology' ? 'DeKUT' : full);
  if (!full) return null;
  if (short === full) return <>{full}</>;
  return (
    <>
      <span className="md:hidden">{short}</span>
      <span className="hidden md:inline">{full}</span>
    </>
  );
}

export function ExploreDiscovery({
  items,
  zones = [],
  city = 'Nyeri',
  campus = null,
  campusName,
}: ExploreDiscoveryProps) {
  const resolvedCampus =
    campus ??
    (campusName ? { name: campusName, short_name: campusName } : null);
  const [category, setCategory] = useState<CategoryKey>('hostel');
  const [selectedZone, setSelectedZone] = useState<string | null>(null);
  const router = useRouter();

  const filtered = useMemo(() => {
    let result = items.filter(
      (item) => (item.property_type ?? 'hostel') === category,
    );
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
    if (category === 'apartment') return 'Apartments';
    if (category === 'short_stay') return 'Short stays';
    return 'Hostels';
  }, [category]);

  const shortName =
    resolvedCampus?.short_name ??
    (resolvedCampus?.name === 'Dedan Kimathi University of Technology'
      ? 'DeKUT'
      : (resolvedCampus?.name ?? ''));
  const sectionTitleShort = selectedZone
    ? `${categoryLabel} in ${selectedZone}`
    : `${categoryLabel} near ${shortName}`;
  const sectionTitleFull = selectedZone
    ? `${categoryLabel} in ${selectedZone}`
    : `${categoryLabel} near ${resolvedCampus?.name ?? shortName}`;

  const sectionSubtitle = useMemo(() => {
    if (selectedZone) return `Verified options in ${selectedZone}`;
    if (category === 'hostel') return 'Student rooms near campus';
    if (category === 'apartment') return `Monthly rentals in ${city}`;
    return `Short stays in ${city}`;
  }, [selectedZone, category, city]);

  const seeAllHref = useMemo(() => {
    if (category === 'short_stay') {
      const params = new URLSearchParams();
      if (selectedZone) params.set('location', selectedZone);
      const qs = params.toString();
      return qs ? `/bnb?${qs}` : '/bnb';
    }
    const params = new URLSearchParams();
    if (selectedZone) params.set('zone', selectedZone);
    if (category) params.set('type', category);
    const qs = params.toString();
    return qs ? `/hostels?${qs}` : '/hostels';
  }, [selectedZone, category]);

  return (
    <section className="mx-auto w-full max-w-6xl px-4 lg:px-8">
      <div className="pt-5 sm:pt-6">
        <div className="flex gap-2">
          {CATEGORIES.map(({ key, label, Icon }) => {
            const active = category === key;
            return (
              <button
                key={key}
                type="button"
                onClick={() => {
                  if (key === 'short_stay') {
                    router.push('/bnb');
                    return;
                  }
                  setCategory(key);
                }}
                aria-pressed={active}
                className={cn(
                  'inline-flex min-h-11 flex-1 items-center justify-center gap-2 rounded-full border px-3 py-3 text-sm font-semibold transition-colors sm:flex-none sm:px-4',
                  active
                    ? 'border-emerald-600 bg-emerald-600 text-white shadow-sm'
                    : 'border-slate-200 bg-white text-slate-700 hover:border-slate-300 hover:bg-slate-50',
                )}
              >
                <Icon
                  className={cn(
                    'h-4 w-4',
                    active ? 'text-white' : 'text-slate-500',
                  )}
                  strokeWidth={2}
                />
                {label}
              </button>
            );
          })}
        </div>
      </div>

      {zones.length > 0 && (
        <div className="mt-6 border-t border-slate-100 pt-5">
          <div className="mb-4 flex items-center justify-between gap-4">
            <h2 className="flex min-w-0 items-center gap-1.5 text-sm font-semibold text-slate-900">
              <MapPin className="h-3.5 w-3.5 text-emerald-600" />
              <span>
                Explore near <ResponsiveCampusName campus={resolvedCampus} />
              </span>
            </h2>
            {selectedZone && (
              <button
                type="button"
                onClick={() => setSelectedZone(null)}
                className="text-xs font-semibold text-emerald-700 hover:text-emerald-800"
              >
                Clear
              </button>
            )}
          </div>

          <div className="scrollbar-none flex gap-2 overflow-x-auto pb-1 pr-4 lg:gap-1.5 lg:px-0">
            <button
              type="button"
              onClick={() => setSelectedZone(null)}
              aria-pressed={selectedZone === null}
              className={cn(
                'min-h-10 shrink-0 rounded-full px-4 py-2.5 text-[13px] font-medium transition-colors',
                selectedZone === null
                  ? 'bg-slate-900 text-white'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200 hover:text-slate-900',
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
                  onClick={() => setSelectedZone(active ? null : zone.name)}
                  aria-pressed={active}
                  className={cn(
                    'min-h-10 shrink-0 rounded-full px-4 py-2.5 text-[13px] font-medium transition-colors',
                    active
                      ? 'bg-emerald-600 text-white'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200 hover:text-slate-900',
                  )}
                >
                  {zone.name}
                </button>
              );
            })}
          </div>
        </div>
      )}

      <div className="mt-8 sm:mt-10">
        <div className="mb-5 flex items-start justify-between gap-4">
          <div className="flex-1">
            <h3 className="text-[19px] font-bold leading-7 tracking-tight text-slate-900 text-balance sm:text-xl sm:leading-7">
              <span className="md:hidden">{sectionTitleShort}</span>
              <span className="hidden md:inline">{sectionTitleFull}</span>
            </h3>
            <p className="mt-2 text-sm font-medium leading-5 text-slate-500">
              {sectionSubtitle}
            </p>
          </div>
          <Link
            href={seeAllHref}
            className="inline-flex min-h-10 shrink-0 items-center gap-1 rounded-full px-2 text-sm font-semibold text-emerald-700 hover:bg-emerald-50 hover:text-emerald-800"
          >
            See all <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </div>

        {filtered.length > 0 ? (
          <div
            aria-label="Scrollable property listings"
            className="scrollbar-hide flex snap-x snap-mandatory gap-3 overflow-x-auto pb-3 pr-4 lg:gap-4 lg:px-0"
          >
            {filtered.map((item) => (
              <ExploreListingCard key={item.id} item={item} />
            ))}
          </div>
        ) : (
          <div className="rounded-2xl border border-slate-200 bg-slate-50 px-6 py-8 text-center">
            <p className="text-sm font-medium text-slate-600">
              No {categoryLabel.toLowerCase()} in {selectedZone} right now.
            </p>
            <button
              type="button"
              onClick={() => setSelectedZone(null)}
              className="mt-3 rounded-full bg-slate-900 px-4 py-1.5 text-xs font-semibold text-white hover:bg-slate-800"
            >
              Show all areas
            </button>
          </div>
        )}
      </div>
    </section>
  );
}
