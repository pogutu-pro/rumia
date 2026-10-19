'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { MapPin } from 'lucide-react';
import { cn } from '@/lib/utils/cn';
import type { ExploreListing } from './explore-listing-card';
import { ListingSection } from './listing-section';
import { formatAreaName, normaliseArea } from '@/lib/utils/area-label';
import { BNB_SEPARATE } from '@/lib/site/separation';
import { BNB_ORIGIN } from '@/lib/site/hosts';

export interface ExploreZone {
  name: string;
  slug?: string;
  count?: number;
}

type CategoryKey = 'hostel' | 'short_stay' | 'apartment';

const CATEGORIES: {
  key: CategoryKey;
  label: string;
  icon: string;
}[] = BNB_SEPARATE
  ? [
      { key: 'hostel', label: 'Hostels', icon: '/images/categories/hostels.png' },
      { key: 'apartment', label: 'Apartments', icon: '/images/categories/apartments.png' },
      // Rumia's way in to RumiaBnB: it leaves the site, so it comes last.
      { key: 'short_stay', label: 'Short stays · RumiaBnB', icon: '/images/categories/short-stays.png' },
    ]
  : [
      { key: 'hostel', label: 'Hostels', icon: '/images/categories/hostels.png' },
      { key: 'short_stay', label: 'Short stays', icon: '/images/categories/short-stays.png' },
      { key: 'apartment', label: 'Apartments', icon: '/images/categories/apartments.png' },
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
      const target = normaliseArea(selectedZone);
      result = result.filter((item) => {
        const area = normaliseArea(item.area);
        const loc = normaliseArea(item.location);
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
    ? `${categoryLabel} in ${formatAreaName(selectedZone)}`
    : `${categoryLabel} near ${shortName}`;
  const sectionTitleFull = selectedZone
    ? `${categoryLabel} in ${formatAreaName(selectedZone)}`
    : `${categoryLabel} near ${shortName}`;

  const sectionSubtitle = useMemo(() => {
    if (selectedZone) return `Listings in ${formatAreaName(selectedZone)}`;
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
    <section className="w-full">
      <div className="px-4 pt-5 lg:px-8">
        <div role="group" aria-label="Property category" className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
          {CATEGORIES.map(({ key, label, icon }) => {
            const active = category === key;
            return (
              <button
                key={key}
                type="button"
                onClick={() => {
                  if (key === 'short_stay') {
                    if (BNB_SEPARATE) window.location.assign(`${BNB_ORIGIN}/`);
                    else router.push('/bnb');
                    return;
                  }
                  setCategory(key);
                  // The area chips belong to Hostels only, so drop any area filter when leaving it.
                  if (key !== 'hostel') setSelectedZone(null);
                }}
                aria-pressed={active}
                className={cn(
                  'inline-flex min-h-11 shrink-0 items-center justify-center gap-2 rounded-full border px-4 text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2',
                  active
                    ? 'border-primary bg-primary text-primary-foreground shadow-sm'
                    : 'border-line bg-raised text-ink hover:bg-subtle',
                )}
              >
                <Image src={icon} alt="" width={32} height={32} className="h-7 w-7 shrink-0 sm:h-8 sm:w-8" aria-hidden />
                {label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Campus areas apply to hostels only; other categories are not tied to a campus. */}
      {category === 'hostel' && zones.length > 0 && (
        <div className="px-4 pt-5 lg:px-8">
          <div className="mb-2 flex items-center justify-between gap-4">
            <h2 className="flex min-w-0 items-center gap-1.5 text-sm font-semibold text-ink">
              <MapPin className="h-3.5 w-3.5 text-primary" aria-hidden />
              <span>
                Explore near <ResponsiveCampusName campus={resolvedCampus} />
              </span>
            </h2>
            {selectedZone && (
              <button
                type="button"
                onClick={() => setSelectedZone(null)}
                className="text-xs font-semibold text-primary hover:underline"
              >
                Clear
              </button>
            )}
          </div>

          <div className="scrollbar-none flex gap-2 overflow-x-auto pb-1">
            <button
              type="button"
              onClick={() => setSelectedZone(null)}
              aria-pressed={selectedZone === null}
              className={cn(
                'min-h-10 shrink-0 rounded-full px-4 text-[13px] font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary',
                selectedZone === null
                  ? 'bg-ink text-white'
                  : 'bg-subtle text-ink-muted hover:text-ink',
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
                    'min-h-10 shrink-0 rounded-full px-4 text-[13px] font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary',
                    active
                      ? 'bg-primary text-primary-foreground'
                      : 'bg-subtle text-ink-muted hover:text-ink',
                  )}
                >
                  {formatAreaName(zone.name)}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {filtered.length > 0 ? (
        <ListingSection
          minItems={1}
          title={
            <>
              <span className="md:hidden">{sectionTitleShort}</span>
              <span className="hidden md:inline">{sectionTitleFull}</span>
            </>
          }
          subtitle={sectionSubtitle}
          seeAllHref={seeAllHref}
          items={filtered}
        />
      ) : (
        <div className="mx-4 mt-8 rounded-2xl border border-line bg-subtle px-6 py-8 text-center lg:mx-8">
          <p className="text-sm font-medium text-ink-muted">
            {selectedZone
              ? `No ${categoryLabel.toLowerCase()} in ${formatAreaName(selectedZone)} right now.`
              : `No ${categoryLabel.toLowerCase()} listed right now.`}
          </p>
          {selectedZone && (
            <button
              type="button"
              onClick={() => setSelectedZone(null)}
              className="mt-3 rounded-full bg-ink px-4 py-1.5 text-xs font-semibold text-white hover:opacity-90"
            >
              Show all areas
            </button>
          )}
        </div>
      )}
    </section>
  );
}
