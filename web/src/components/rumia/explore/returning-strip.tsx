'use client';

import Link from 'next/link';
import { useEffect, useState, useSyncExternalStore } from 'react';
import { PropertyCard } from '@/components/rumia/property-card';
import { rumia, type SearchCard } from '@/lib/api/rumia';
import { forgetEverything, lastSearch, recentlyViewed, type LastSearch } from '@/lib/rumia/memory';

const subscribeNever = () => () => {};
let cachedLast: LastSearch | null | undefined;
const readLast = () => (cachedLast === undefined ? (cachedLast = lastSearch()) : cachedLast);

/**
 * For a returning browser: pick up the last search and the places they looked at. Nothing is shown to a new
 * visitor, and "Clear" wipes it. This is the first piece of personalisation, and it needs no account.
 */
export function ReturningStrip({ currentHref }: { currentHref: string }) {
  const last = useSyncExternalStore(subscribeNever, readLast, () => null);
  const [recent, setRecent] = useState<SearchCard[]>([]);
  const [hidden, setHidden] = useState(false);

  useEffect(() => {
    const ids = recentlyViewed(6);
    if (ids.length === 0) return;
    void rumia
      .GET('/api/v1/discovery/cards', { params: { query: { ids: ids.join(',') } } })
      .then((r) => setRecent(r.data?.items ?? []))
      .catch(() => null);
  }, []);

  if (hidden || (!last && recent.length === 0)) return null;
  const showContinue = last && last.href !== currentHref && last.href !== '/';

  return (
    <section aria-label="Pick up where you left off" className="space-y-4">
      {showContinue && (
        <Link href={last.href} className="flex min-h-14 items-center justify-between rounded-rum-media border border-rum-line bg-rum-raised px-4 py-3">
          <span>
            <span className="block text-sm text-rum-muted">Continue your search</span>
            <span className="block text-base font-semibold text-rum-text">{last.label}</span>
          </span>
          <span aria-hidden="true">→</span>
        </Link>
      )}
      {recent.length > 0 && (
        <div>
          <h2 className="mb-2 text-base font-semibold">Recently viewed</h2>
          <div className="rum-scroll-x -mx-4 flex gap-4 overflow-x-auto px-4 lg:mx-0 lg:px-0">
            {recent.map((c, i) => (
              <div key={c.id} className="w-56 shrink-0"><PropertyCard card={c} position={i} /></div>
            ))}
          </div>
        </div>
      )}
      <button type="button" onClick={() => { forgetEverything(); setHidden(true); }} className="text-sm text-rum-muted underline underline-offset-2">
        Clear this history
      </button>
    </section>
  );
}
