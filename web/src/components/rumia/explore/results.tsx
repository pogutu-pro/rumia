'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2, Map as MapIcon } from 'lucide-react';
import { PropertyCard } from '@/components/rumia/property-card';
import { MapPanel, MobileMap, mapEnabled } from '@/components/rumia/explore/explore-map';
import { rumia, type SearchCard } from '@/lib/api/rumia';
import { centerOf, nearestLandmark } from '@/lib/rumia/geo';
import { filtersHref, toApiQuery, type ExploreFilters } from '@/lib/rumia/explore-params';
import { track } from '@/lib/events';

interface Landmark {
  slug: string;
  name: string;
  lat?: number | null;
  lng?: number | null;
}

interface Props {
  filters: ExploreFilters;
  initial: SearchCard[];
  total: number;
  nextCursor: string | null;
  landmarks: Landmark[];
}

const SORTS: Array<[string, string]> = [['', 'Best match'], ['newest', 'Newest'], ['price_asc', 'Lowest price'], ['price_desc', 'Highest price']];
const NYERI = { lat: -0.4169, lng: 36.9511 };

export function ExploreResults({ filters, initial, total, nextCursor, landmarks }: Props) {
  const router = useRouter();
  const [items, setItems] = useState(initial);
  const [cursor, setCursor] = useState(nextCursor);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const [mapOpen, setMapOpen] = useState(false);
  const [pendingArea, setPendingArea] = useState<Landmark | null>(null);

  const mapOn = mapEnabled();

  // A new search renders new server data; start from it again.
  const key = JSON.stringify(filters);
  const [seen, setSeen] = useState(key);
  if (seen !== key) {
    setSeen(key);
    setItems(initial);
    setCursor(nextCursor);
    setError(false);
    setHoveredId(null);
    setPendingArea(null);
    setMapOpen(false);
  }

  const points = useMemo(
    () =>
      items
        .filter((c) => typeof c.lat === 'number' && typeof c.lng === 'number')
        .map((c) => ({ id: c.id, slug: c.slug, name: c.name, lat: c.lat as number, lng: c.lng as number })),
    [items],
  );
  const center = useMemo(() => {
    const fromResults = centerOf(points);
    if (fromResults) return fromResults;
    return centerOf(landmarks) ?? NYERI;
  }, [points, landmarks]);

  const countLabel = total === 0 ? 'No places yet' : `${total} place${total === 1 ? '' : 's'}`;

  function onCameraChange(c: { lat: number; lng: number }) {
    const nearest = nearestLandmark(c, landmarks);
    setPendingArea(nearest && nearest.slug !== filters.near ? { slug: nearest.slug, name: nearest.name ?? nearest.slug } : null);
  }

  function searchArea() {
    if (!pendingArea) return;
    router.push(filtersHref({ ...filters, near: pendingArea.slug }), { scroll: false });
    setPendingArea(null);
  }

  async function more() {
    if (!cursor || loading) return;
    setLoading(true);
    setError(false);
    const { data } = await rumia
      .GET('/api/v1/discovery/search', { params: { query: toApiQuery(filters, { cursor }) } })
      .catch(() => ({ data: undefined }));
    setLoading(false);
    if (!data) return setError(true);
    setItems((prev) => [...prev, ...data.items.filter((n) => !prev.some((p) => p.id === n.id))]);
    setCursor(data.next_cursor ?? null);
    track('results_impression', { surface: 'explore', market: 'nyeri', props: { ids: data.items.map((i) => i.id).slice(0, 20), page: 'more' } });
  }

  return (
    <section
      aria-label="Results"
      className={mapOn ? 'lg:grid lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)] lg:items-start lg:gap-6' : undefined}
    >
      <div>
        <div className="mb-3 flex items-center justify-between gap-3">
          <h2 className="text-base font-semibold" aria-live="polite">
            {countLabel}
          </h2>
          <label className="flex items-center gap-2 text-sm text-rum-muted">
            <span className="sr-only sm:not-sr-only">Sort</span>
            <select
              value={filters.sort}
              onChange={(e) => router.push(filtersHref({ ...filters, sort: e.target.value }), { scroll: false })}
              className="min-h-11 rounded-rum-control border border-rum-line bg-rum-raised px-3 text-sm text-rum-text"
            >
              {SORTS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
            </select>
          </label>
        </div>
        <div className="grid grid-cols-1 gap-x-5 gap-y-7 sm:grid-cols-2 xl:grid-cols-3">
          {items.map((c, i) => (
            <div
              key={c.id}
              onMouseEnter={() => setHoveredId(c.id)}
              onMouseLeave={() => setHoveredId(null)}
              onFocus={() => setHoveredId(c.id)}
              onBlur={() => setHoveredId(null)}
            >
              <PropertyCard card={c} position={i} priority={i < 2} />
            </div>
          ))}
        </div>
        {cursor ? (
          <div className="mt-8 text-center">
            <button
              type="button"
              onClick={more}
              disabled={loading}
              className="inline-flex min-h-12 items-center gap-2 rounded-rum-control border border-rum-line bg-rum-raised px-6 text-base font-semibold text-rum-text disabled:opacity-70"
            >
              {loading && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
              Show more
            </button>
            <p className="mt-2 text-sm text-rum-muted">Showing {items.length} of {total}</p>
            {error && <p role="alert" className="mt-2 text-sm text-rum-danger">Could not load more. Check your connection and try again.</p>}
          </div>
        ) : (
          total > 0 && <p className="mt-8 text-center text-sm text-rum-muted">That is everything that matches.</p>
        )}
      </div>

      {mapOn && (
        <div className="relative hidden lg:sticky lg:top-20 lg:block">
          <MapPanel
            points={points}
            center={center}
            hoveredId={hoveredId}
            onCameraChange={onCameraChange}
            className="h-[calc(100vh-6rem)]"
          />
          {pendingArea && (
            <button
              type="button"
              onClick={searchArea}
              className="absolute left-1/2 top-3 z-10 -translate-x-1/2 rounded-full bg-rum-accent px-4 py-2 text-sm font-semibold text-rum-on-accent shadow-lg"
            >
              Search this area
            </button>
          )}
        </div>
      )}

      {mapOn && (
        <MobileMap
          open={mapOpen}
          onClose={() => setMapOpen(false)}
          title={countLabel}
          points={points}
          center={center}
          hoveredId={hoveredId}
          onCameraChange={onCameraChange}
        />
      )}

      {mapOn && (
        <button
          type="button"
          onClick={() => setMapOpen(true)}
          className="fixed bottom-5 left-1/2 z-40 inline-flex min-h-12 -translate-x-1/2 items-center gap-2 rounded-full bg-rum-accent px-6 text-base font-semibold text-rum-on-accent shadow-lg lg:hidden"
        >
          <MapIcon className="h-4 w-4" aria-hidden="true" />
          Map
        </button>
      )}
    </section>
  );
}
