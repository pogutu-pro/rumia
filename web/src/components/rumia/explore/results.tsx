'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2 } from 'lucide-react';
import { PropertyCard } from '@/components/rumia/property-card';
import { rumia, type SearchCard } from '@/lib/api/rumia';
import { filtersHref, toApiQuery, type ExploreFilters } from '@/lib/rumia/explore-params';
import { track } from '@/lib/events';

interface Props {
  filters: ExploreFilters;
  initial: SearchCard[];
  total: number;
  nextCursor: string | null;
}

const SORTS: Array<[string, string]> = [['', 'Best match'], ['newest', 'Newest'], ['price_asc', 'Lowest price'], ['price_desc', 'Highest price']];

export function ExploreResults({ filters, initial, total, nextCursor }: Props) {
  const router = useRouter();
  const [items, setItems] = useState(initial);
  const [cursor, setCursor] = useState(nextCursor);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);

  // A new search renders new server data; start from it again.
  const key = JSON.stringify(filters);
  const [seen, setSeen] = useState(key);
  if (seen !== key) {
    setSeen(key);
    setItems(initial);
    setCursor(nextCursor);
    setError(false);
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
    <section aria-label="Results">
      <div className="mb-3 flex items-center justify-between gap-3">
        <h2 className="text-base font-semibold" aria-live="polite">
          {total === 0 ? 'No places yet' : `${total} place${total === 1 ? '' : 's'}`}
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
          <PropertyCard key={c.id} card={c} position={i} priority={i < 2} />
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
    </section>
  );
}
