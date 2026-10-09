'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Clock, Loader2, Search, X } from 'lucide-react';
import { rumia, type SearchResponse } from '@/lib/api/rumia';
import { track } from '@/lib/events';
import { forgetSearches, personalise, readTaste, rememberInterest, rememberSearch, type Taste } from '@/lib/personalisation';
import { DiscoveryCard } from '@/components/discovery/search-card';
import { AlertButton } from '@/components/discovery/alert-button';

const EXAMPLES = ['bedsitter near DeKUT under 8k', 'single room with wifi', 'apartment in town', 'cheapest hostel near the gate'];

/** The parts of the response that describe the search and are safe to save as an alert. */
export function alertIntent(q: string, applied: Record<string, unknown>): Record<string, unknown> {
  const { sort: _sort, new_since: _newSince, offset: _offset, cursor: _cursor, ...rest } = applied;
  return { ...rest, q };
}

/** Remounts per query, so each search starts from a clean loading state. */
export function SmartSearch() {
  const q = (useSearchParams().get('q') ?? '').trim();
  return <SearchResults key={q} q={q} />;
}

function SearchResults({ q }: { q: string }) {
  const router = useRouter();
  const [draft, setDraft] = useState(q);
  const [data, setData] = useState<SearchResponse | null>(null);
  const [extra, setExtra] = useState<SearchResponse['items']>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [state, setState] = useState<'idle' | 'loading' | 'error'>('loading');
  const [more, setMore] = useState(false);
  const [taste, setTaste] = useState<Taste | null>(null);
  const requestId = useRef(0);

  useEffect(() => {
    const id = ++requestId.current;
    let active = true;
    (async () => {
      try {
        const res = await rumia.GET('/api/v1/discovery/search', { params: { query: { q: q || undefined, limit: 24 } } });
        if (!active || id !== requestId.current) return;
        if (!res.data) throw new Error('search failed');
        setData(res.data);
        setCursor(res.data.next_cursor ?? null);
        setState('idle');
        if (q) rememberSearch(q);
        setTaste(readTaste());
        if (q) {
          track('search_performed', { surface: 'explore', props: { total: res.data.total, source: 'smart_search' } });
        }
      } catch {
        if (active && id === requestId.current) setState('error');
      }
    })();
    return () => {
      active = false;
    };
  }, [q]);

  const submit = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault();
      const next = draft.trim();
      router.push(next ? `/search?q=${encodeURIComponent(next)}` : '/search');
    },
    [draft, router],
  );

  async function loadMore() {
    if (!cursor || more) return;
    setMore(true);
    try {
      const res = await rumia.GET('/api/v1/discovery/search', { params: { query: { q: q || undefined, limit: 24, cursor } } });
      if (res.data) {
        setExtra((prev) => [...prev, ...res.data!.items]);
        setCursor(res.data.next_cursor ?? null);
      }
    } finally {
      setMore(false);
    }
  }

  const items = useMemo(() => {
    const all = [...(data?.items ?? []), ...extra];
    // With a query the server's explained ranking is kept as is. With none, order by what this person has been looking at.
    return !q && taste ? personalise(all, taste) : all;
  }, [data, extra, q, taste]);

  function rememberAppliedInterest() {
    const applied = data?.applied as { kind?: string; max_price?: number } | undefined;
    if (applied?.kind || applied?.max_price) rememberInterest({ kind: applied.kind, price: applied.max_price });
  }

  return (
    <div className="mx-auto max-w-6xl px-4 py-6 sm:px-6 lg:px-8">
      <form onSubmit={submit} role="search" className="relative">
        <label htmlFor="smart-q" className="sr-only">
          Describe the place you want
        </label>
        <Search className="pointer-events-none absolute left-3.5 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400" aria-hidden="true" />
        <input
          id="smart-q"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder="Try: bedsitter near DeKUT under 8k with wifi"
          enterKeyHint="search"
          autoComplete="off"
          className="h-12 w-full rounded-xl border border-slate-200 bg-white pl-11 pr-24 text-[15px] font-medium text-slate-900 placeholder:text-slate-500 focus:border-emerald-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
        />
        {draft && (
          <button
            type="button"
            onClick={() => {
              setDraft('');
              router.push('/search');
            }}
            className="absolute right-[4.5rem] top-1/2 inline-flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100"
            aria-label="Clear search"
          >
            <X className="h-4 w-4" aria-hidden="true" />
          </button>
        )}
        <button type="submit" className="absolute right-1.5 top-1/2 h-9 -translate-y-1/2 rounded-lg bg-slate-900 px-4 text-sm font-semibold text-white">
          Search
        </button>
      </form>

      {!q && (
        <div className="mt-4 space-y-4">
          {taste && taste.searches.length > 0 && (
            <div>
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-bold text-slate-900">Recent searches</h2>
                <button
                  type="button"
                  onClick={() => {
                    forgetSearches();
                    setTaste(readTaste());
                  }}
                  className="min-h-11 px-2 text-xs font-semibold text-slate-500 hover:text-slate-800"
                >
                  Clear
                </button>
              </div>
              <ul className="flex flex-wrap gap-2">
                {taste.searches.map((s) => (
                  <li key={s}>
                    <Link href={`/search?q=${encodeURIComponent(s)}`} className="inline-flex min-h-11 items-center gap-1.5 rounded-full border border-slate-200 bg-white px-3.5 text-sm text-slate-700 hover:border-slate-300">
                      <Clock className="h-3.5 w-3.5 text-slate-400" aria-hidden="true" />
                      {s}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          )}
          <div>
            <h2 className="text-sm font-bold text-slate-900">Or try</h2>
            <ul className="mt-2 flex flex-wrap gap-2">
              {EXAMPLES.map((s) => (
                <li key={s}>
                  <Link href={`/search?q=${encodeURIComponent(s)}`} className="inline-flex min-h-11 items-center rounded-full bg-emerald-50 px-3.5 text-sm font-medium text-emerald-800 hover:bg-emerald-100">
                    {s}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}

      <div className="mt-6" aria-live="polite">
        {state === 'loading' && !data && (
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-4" role="status" aria-busy="true" aria-label="Searching">
            {[0, 1, 2, 3].map((i) => (
              <div key={i} className="aspect-[4/3] animate-pulse rounded-2xl bg-slate-100" />
            ))}
          </div>
        )}
        {state === 'error' && <p className="text-sm text-slate-600">We could not search right now. Check your connection and try again.</p>}

        {data && (
          <>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h1 className="text-lg font-bold text-slate-900">
                  {q ? (data.total === 0 ? 'No exact matches' : `${data.total} place${data.total === 1 ? '' : 's'}`) : 'Picked for you'}
                </h1>
                {data.chips.length > 0 && (
                  <ul className="mt-1.5 flex flex-wrap gap-1.5" aria-label="What we understood">
                    {data.chips.map((c, i) => (
                      <li key={`${c.key}-${i}`} className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-700">
                        {c.label}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
              {q && <AlertButton intent={alertIntent(q, data.applied)} label={q} />}
            </div>

            {data.relaxations.length > 0 && data.total === 0 && (
              <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-4">
                <p className="text-sm font-semibold text-amber-900">Nothing matches all of that. You could loosen one thing:</p>
                <ul className="mt-2 flex flex-wrap gap-2">
                  {data.relaxations.map((r) => (
                    <li key={r.label} className="rounded-full bg-white px-3 py-1.5 text-sm text-amber-900 ring-1 ring-amber-200">
                      {r.label} <span className="text-amber-700">({r.count})</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {items.length > 0 && (
              <div className="mt-4 grid grid-cols-2 gap-x-4 gap-y-6 lg:grid-cols-4" onClickCapture={rememberAppliedInterest}>
                {items.map((card) => (
                  <DiscoveryCard key={card.id} card={card} />
                ))}
              </div>
            )}

            {cursor && (
              <div className="mt-8 text-center">
                <button
                  type="button"
                  onClick={() => void loadMore()}
                  disabled={more}
                  className="inline-flex min-h-12 items-center gap-2 rounded-xl border border-slate-300 bg-white px-6 text-sm font-semibold text-slate-900 hover:bg-slate-50 disabled:opacity-60"
                >
                  {more && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
                  Show more
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
