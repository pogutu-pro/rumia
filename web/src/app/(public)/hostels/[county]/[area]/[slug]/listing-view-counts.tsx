'use client';

import { useEffect, useState } from 'react';
import { Eye } from 'lucide-react';
import type { ListingViewCounts } from '@/lib/listing-views';

const EMPTY_COUNTS: ListingViewCounts = {
  today: 0,
  week: 0,
  month: 0,
  allTime: 0,
};

const POLL_INTERVAL_MS = 60_000;

const inFlightFetches = new Map<string, Promise<ListingViewCounts | null>>();

interface PollerStore {
  emit: Set<(counts: ListingViewCounts) => void>;
  timer: ReturnType<typeof setInterval> | null;
  onVisible: (() => void) | null;
}

const pollers = new Map<string, PollerStore>();

function toCount(value: unknown) {
  const parsed = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function formatListingViewLine(counts: ListingViewCounts) {
  return [
    `${counts.today.toLocaleString()} views today`,
    `${counts.week.toLocaleString()} this week`,
    `${counts.month.toLocaleString()} this month`,
    `${counts.allTime.toLocaleString()} since listed`,
  ].join(' · ');
}

function fetchListingViewCounts(
  listingId: string,
): Promise<ListingViewCounts | null> {
  const pending = inFlightFetches.get(listingId);
  if (pending) return pending;

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey) return Promise.resolve(null);

  const url = new URL(`${supabaseUrl}/rest/v1/rpc/get_listing_view_counts`);
  url.searchParams.set('p_listing_id', listingId);

  const promise = fetch(url, {
    method: 'GET',
    headers: {
      apikey: supabaseAnonKey,
      Authorization: `Bearer ${supabaseAnonKey}`,
    },
  })
    .then((res) => (res.ok ? res.json() : null))
    .then((rows) => {
      if (!rows) return null;
      const row = Array.isArray(rows) ? rows[0] : rows;
      if (!row) return null;
      return {
        today: toCount(row.today_count),
        week: toCount(row.week_count),
        month: toCount(row.month_count),
        allTime: toCount(row.all_time_count),
      };
    })
    .catch(() => null);

  inFlightFetches.set(listingId, promise);
  void promise.finally(() => inFlightFetches.delete(listingId));
  return promise;
}

async function refreshCounts(listingId: string) {
  const fresh = await fetchListingViewCounts(listingId);
  if (!fresh) return;
  const store = pollers.get(listingId);
  if (!store) return;
  for (const emit of store.emit) emit(fresh);
}

function stopPoller(listingId: string) {
  const store = pollers.get(listingId);
  if (!store) return;
  if (store.timer) clearInterval(store.timer);
  if (store.onVisible) {
    document.removeEventListener('visibilitychange', store.onVisible);
  }
  pollers.delete(listingId);
}

function startPollerIfNeeded(listingId: string) {
  const store = pollers.get(listingId);
  if (!store || store.timer) return;

  store.timer = setInterval(() => {
    if (document.visibilityState === 'hidden') return;
    void refreshCounts(listingId);
  }, POLL_INTERVAL_MS);

  store.onVisible = () => {
    if (document.visibilityState === 'visible') {
      void refreshCounts(listingId);
    }
  };
  document.addEventListener('visibilitychange', store.onVisible);
}

function subscribe(listener: (counts: ListingViewCounts) => void, listingId: string) {
  let store = pollers.get(listingId);
  if (!store) {
    store = { emit: new Set(), timer: null, onVisible: null };
    pollers.set(listingId, store);
  }
  store.emit.add(listener);
  startPollerIfNeeded(listingId);

  return () => {
    const current = pollers.get(listingId);
    if (!current) return;
    current.emit.delete(listener);
    if (current.emit.size === 0) stopPoller(listingId);
  };
}

function useListingViewCounts(
  listingId: string,
  initialCounts: ListingViewCounts,
) {
  const [counts, setCounts] = useState<ListingViewCounts>(initialCounts);

  useEffect(() => {
    if (!listingId) return;

    let cancelled = false;
    fetchListingViewCounts(listingId).then((fresh) => {
      if (!cancelled && fresh) setCounts(fresh);
    });

    const unsubscribe = subscribe(setCounts, listingId);

    return () => {
      cancelled = true;
      unsubscribe();
    };
  }, [listingId]);

  return counts;
}

interface ListingViewCountsAllTimeProps {
  listingId: string;
  initialCounts?: ListingViewCounts;
  className?: string;
  iconSize?: number;
}

export function ListingViewCountsAllTime({
  listingId,
  initialCounts,
  className,
  iconSize = 4,
}: ListingViewCountsAllTimeProps) {
  const counts = useListingViewCounts(listingId, initialCounts ?? EMPTY_COUNTS);
  return (
    <span className={`inline-flex items-center gap-1 ${className ?? ''}`}>
      <Eye className={`h-${iconSize} w-${iconSize}`} />
      {counts.allTime.toLocaleString()}
    </span>
  );
}

interface ListingViewCountsLineProps {
  listingId: string;
  initialCounts?: ListingViewCounts;
}

export function ListingViewCountsLine({
  listingId,
  initialCounts,
}: ListingViewCountsLineProps) {
  const counts = useListingViewCounts(listingId, initialCounts ?? EMPTY_COUNTS);
  return (
    <p className="inline-flex items-center gap-1.5 text-sm font-bold text-blue-700">
      <Eye className="h-4 w-4" />
      {formatListingViewLine(counts)}
    </p>
  );
}