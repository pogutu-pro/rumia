'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Clock } from 'lucide-react';
import { rumia, type SearchCard } from '@/lib/api/rumia';
import { personalise, readTaste, type Taste } from '@/lib/personalisation';
import { DiscoveryCard } from '@/components/discovery/search-card';

function topKey(map: Record<string, number>): string | undefined {
  return Object.entries(map).sort((a, b) => b[1] - a[1])[0]?.[0];
}

/**
 * Shortcuts that follow what this person has been doing on this device: their recent searches, and a row of
 * places like the ones they keep opening. Shows nothing for someone new, so the home page is unchanged for them.
 */
export function ForYou() {
  const [taste, setTaste] = useState<Taste | null>(null);
  const [cards, setCards] = useState<SearchCard[]>([]);

  useEffect(() => {
    let active = true;
    (async () => {
      await Promise.resolve();
      const t = readTaste();
      if (!active) return;
      setTaste(t);
      const kind = topKey(t.kinds);
      if (!kind && !t.price) return;
      const res = await rumia
        .GET('/api/v1/discovery/search', {
          params: { query: { kind: kind as 'hostel' | undefined, max_price: t.price ? Math.round(t.price.mean * 1.3) : undefined, limit: 12 } },
        })
        .catch(() => null);
      if (active && res?.data) setCards(personalise(res.data.items, t).slice(0, 8));
    })();
    return () => {
      active = false;
    };
  }, []);

  if (!taste || (taste.searches.length === 0 && cards.length === 0)) return null;

  return (
    <section aria-label="For you" className="mx-auto w-full max-w-6xl px-4 pt-6 lg:px-8">
      {taste.searches.length > 0 && (
        <div>
          <h2 className="text-sm font-bold text-slate-900">Pick up where you left off</h2>
          <ul className="mt-2 flex gap-2 overflow-x-auto pb-1">
            {taste.searches.slice(0, 4).map((s) => (
              <li key={s} className="shrink-0">
                <Link href={`/search?q=${encodeURIComponent(s)}`} className="inline-flex min-h-11 items-center gap-1.5 rounded-full border border-slate-200 bg-white px-3.5 text-sm text-slate-700 hover:border-slate-300">
                  <Clock className="h-3.5 w-3.5 text-slate-400" aria-hidden="true" />
                  {s}
                </Link>
              </li>
            ))}
          </ul>
        </div>
      )}
      {cards.length > 0 && (
        <div className="mt-5">
          <div className="flex items-baseline justify-between">
            <h2 className="text-lg font-bold text-slate-900">Picked for you</h2>
            <Link href="/search" className="text-sm font-semibold text-emerald-700 underline underline-offset-2">
              See more
            </Link>
          </div>
          <div className="mt-3 grid grid-cols-2 gap-x-4 gap-y-6 lg:grid-cols-4">
            {cards.map((c) => (
              <DiscoveryCard key={c.id} card={c} />
            ))}
          </div>
        </div>
      )}
    </section>
  );
}
