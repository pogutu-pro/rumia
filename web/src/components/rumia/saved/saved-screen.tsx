'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { CheckCheck, GitCompareArrows, Heart, X } from 'lucide-react';
import { PropertyCard, PropertyCardSkeleton } from '@/components/rumia/property-card';
import { CompareTable } from './compare-table';
import { AlertsList } from './alerts-list';
import { rumia, type PropertyRead, type SearchCard } from '@/lib/api/rumia';
import { hasStoredSession } from '@/lib/supabase/client';
import { useWishlistStore } from '@/stores/wishlist-store';
import { cn } from '@/lib/utils/cn';

type Tab = 'places' | 'alerts';

/** /saved: device-first saves with status, a 2–3 way compare, and alerts (ux/04 §4). */
export function SavedScreen({ initialTab }: { initialTab: Tab }) {
  const router = useRouter();
  const [tab, setTab] = useState<Tab>(initialTab);
  const [allCards, setAllCards] = useState<SearchCard[]>([]);
  const [state, setState] = useState<'loading' | 'ready' | 'error'>('loading');
  const [selecting, setSelecting] = useState(false);
  const [compare, setCompare] = useState<string[]>([]);
  const [comparing, setComparing] = useState(false);
  const [compareProps, setCompareProps] = useState<Record<string, PropertyRead>>({});
  const [mounted, setMounted] = useState(false);

  const savedMap = useWishlistStore((s) => s.saved);
  const wishlistFetched = useWishlistStore((s) => s.fetched);
  const fetchBatch = useWishlistStore((s) => s.fetchBatch);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setMounted(true);
    let active = true;
    (async () => {
      setState('loading');
      await fetchBatch();
      if (!active) return;
      const store = useWishlistStore.getState();
      const ids = Object.keys(store.saved).filter((k) => store.saved[k]);
      if (ids.length === 0) {
        setAllCards([]);
        setState('ready');
        return;
      }
      const res = await rumia
        .GET('/api/v1/discovery/cards', { params: { query: { ids: ids.join(',') } } })
        .catch(() => ({ data: undefined }));
      if (!active) return;
      if (!res?.data) {
        setState('error');
        return;
      }
      setAllCards(res.data.items ?? []);
      setState('ready');
    })();
    return () => {
      active = false;
    };
  }, [fetchBatch]);

  // Live view of what is still saved; unsaving a card removes it from this screen.
  const savedNow = useMemo(() => {
    if (!wishlistFetched) return new Set(allCards.map((c) => c.listing_id ?? c.id));
    return new Set(Object.keys(savedMap).filter((k) => savedMap[k]));
  }, [wishlistFetched, savedMap, allCards]);

  const cards = useMemo(() => allCards.filter((c) => savedNow.has(c.listing_id ?? c.id)), [allCards, savedNow]);

  // Only what is still saved counts (un-saving a compared place silently drops it).
  const activeCompare = compare.filter((id) => savedNow.has(id));

  const signedIn = mounted && hasStoredSession();
  const canCompare = activeCompare.length >= 2 && activeCompare.length <= 3;

  function switchTab(next: Tab) {
    setTab(next);
    router.replace(next === 'alerts' ? '/saved?tab=alerts' : '/saved', { scroll: false });
  }

  function toggleCompare(listingId: string) {
    setCompare((prev) =>
      prev.includes(listingId)
        ? prev.filter((id) => id !== listingId)
        : prev.length >= 3
          ? prev
          : [...prev, listingId],
    );
  }

  async function openCompare() {
    const selected = cards.filter((c) => activeCompare.includes(c.listing_id ?? c.id));
    const props = await Promise.all(
      selected.map(async (c) => {
        const { data } = await rumia.GET('/api/v1/properties/{slug}', { params: { path: { slug: c.slug } } }).catch(() => ({ data: undefined }));
        return [c.slug, data] as const;
      }),
    );
    const map: Record<string, PropertyRead> = {};
    for (const [slug, data] of props) if (data) map[slug] = data;
    setCompareProps(map);
    setComparing(true);
    window.scrollTo({ top: 0 });
  }

  const headline = tab === 'places' ? 'Saved' : 'Alerts';
  const suggestSignIn = tab === 'places' && !signedIn && cards.length >= 2;

  return (
    <div className="mx-auto max-w-6xl px-4 pb-24 pt-6 lg:px-8">
      <header className="space-y-1">
        <h1 className="text-2xl font-semibold leading-tight text-rum-text sm:text-3xl">{headline}</h1>
        {tab === 'places' && (
          <p className="text-base text-rum-muted">
            Saved on this phone
            {suggestSignIn && (
              <>
                {' · '}
                <Link href="/auth/login" className="font-medium underline underline-offset-2">
                  Keep them on any device
                </Link>
              </>
            )}
          </p>
        )}
      </header>

      <div role="tablist" aria-label="Saved sections" className="mt-4 inline-flex rounded-full border border-rum-line bg-rum-raised p-1 text-sm">
        {(['places', 'alerts'] as const).map((t) => (
          <button
            key={t}
            role="tab"
            id={`saved-tab-${t}`}
            aria-selected={tab === t}
            aria-controls={`saved-panel-${t}`}
            onClick={() => switchTab(t)}
            className={cn('min-h-10 rounded-full px-5 font-medium', tab === t ? 'bg-rum-accent text-rum-on-accent' : 'text-rum-text')}
          >
            {t === 'places' ? 'Places' : 'Alerts'}
          </button>
        ))}
      </div>

      {tab === 'alerts' ? (
        <div id="saved-panel-alerts" role="tabpanel" aria-labelledby="saved-tab-alerts" className="mt-5">
          <AlertsList />
          <p className="mt-4 text-sm text-rum-muted">
            New alerts are added from a search: <Link href="/" className="font-medium text-rum-accent underline underline-offset-2">pick your filters on Explore</Link>, then tap
            “Tell me when something matches”.
          </p>
        </div>
      ) : (
        <div id="saved-panel-places" role="tabpanel" aria-labelledby="saved-tab-places" className="mt-5">
          {state === 'error' ? (
            <div role="alert" className="rounded-rum-media border border-rum-line bg-rum-raised p-6 text-center">
              <p className="text-base font-semibold">We could not load your saved places.</p>
              <p className="mt-1 text-sm text-rum-muted">Check your connection, then try again.</p>
            </div>
          ) : state === 'loading' ? (
            <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {Array.from({ length: 6 }).map((_, i) => (
                <PropertyCardSkeleton key={i} />
              ))}
            </div>
          ) : cards.length === 0 ? (
            <div className="rounded-rum-media border border-rum-line bg-rum-raised p-6 text-center">
              <Heart className="mx-auto h-6 w-6 text-rum-muted" aria-hidden="true" />
              <p className="mt-2 text-base font-semibold">Nothing saved yet</p>
              <p className="mt-1 text-sm text-rum-muted">Tap the heart on any place to keep it here.</p>
              <Link href="/" className="mt-4 inline-flex min-h-11 items-center rounded-rum-control bg-rum-accent px-5 text-base font-semibold text-rum-on-accent">
                Explore places
              </Link>
            </div>
          ) : comparing ? (
            <div className="space-y-4">
              <button type="button" onClick={() => setComparing(false)} className="min-h-11 rounded-rum-control border border-rum-line bg-rum-raised px-4 text-base font-medium">
                ← Back to saved
              </button>
              <CompareTable cards={cards.filter((c) => activeCompare.includes(c.listing_id ?? c.id))} properties={compareProps} />
            </div>
          ) : (
            <>
              <div className="mb-3 flex items-center justify-between gap-3">
                <p className="text-sm text-rum-muted">
                  {cards.length} saved
                  {selecting && <span className="ml-1">· {activeCompare.length} selected</span>}
                </p>
                <button
                  type="button"
                  aria-pressed={selecting}
                  onClick={() => {
                    setSelecting((s) => !s);
                    if (selecting) setCompare([]);
                  }}
                  className={cn('inline-flex min-h-10 items-center gap-1.5 rounded-full border px-4 text-sm font-medium', selecting ? 'border-rum-accent bg-rum-accent/10 text-rum-accent-strong' : 'border-rum-line bg-rum-raised text-rum-text')}
                >
                  <GitCompareArrows className="h-4 w-4" aria-hidden="true" />
                  {selecting ? 'Done' : 'Compare'}
                </button>
              </div>
              <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
                {cards.map((c, i) => {
                  const id = c.listing_id ?? c.id;
                  const selected = activeCompare.includes(id);
                  return (
                    <div key={id} className="relative">
                      {selecting && (
                        <button
                          type="button"
                          aria-pressed={selected}
                          aria-label={`${selected ? 'Remove' : 'Add'} ${c.name} ${selected ? 'from' : 'to'} comparison`}
                          onClick={() => toggleCompare(id)}
                          className={cn(
                            'absolute left-2 top-2 z-10 flex h-9 w-9 items-center justify-center rounded-full shadow-rum-float transition-colors',
                            selected ? 'bg-rum-accent text-rum-on-accent' : 'bg-rum-raised text-rum-muted hover:text-rum-text',
                          )}
                        >
                          {selected && activeCompare.length > 1 ? (
                            <span className="text-sm font-semibold">{activeCompare.indexOf(id) + 1}</span>
                          ) : (
                            <CheckCheck className="h-5 w-5" aria-hidden="true" />
                          )}
                        </button>
                      )}
                      <PropertyCard card={c} position={i} surface="saved" />
                    </div>
                  );
                })}
              </div>

              {activeCompare.length > 0 && (
                <div className="fixed inset-x-0 bottom-0 z-40 border-t border-rum-line bg-rum-raised px-4 py-3 shadow-rum-float">
                  <div className="mx-auto flex max-w-6xl items-center gap-3">
                    <button
                      type="button"
                      onClick={() => setCompare([])}
                      aria-label="Clear comparison"
                      className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-rum-muted hover:bg-rum-sunken"
                    >
                      <X className="h-5 w-5" aria-hidden="true" />
                    </button>
                    <p className="min-w-0 flex-1 truncate text-sm text-rum-muted">
                      {activeCompare.length === 1
                        ? 'Select one more to compare'
                        : `${activeCompare.length} places selected`}
                    </p>
                    <button
                      type="button"
                      disabled={!canCompare}
                      onClick={openCompare}
                      className="inline-flex min-h-12 shrink-0 items-center gap-2 rounded-rum-control bg-rum-accent px-5 text-base font-semibold text-rum-on-accent disabled:opacity-60"
                    >
                      <GitCompareArrows className="h-5 w-5" aria-hidden="true" />
                      Compare
                    </button>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}