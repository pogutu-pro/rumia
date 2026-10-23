'use client';

import { useSyncExternalStore } from 'react';
import { fetchPublicApi } from '@/lib/api/config';

/**
 * Today's views for every listing, fetched once per page however many cards ask (the API answers from a one-minute
 * cache, one grouped query). Cards read their own count from the shared map.
 */
let counts: Record<string, number> | null = null;
let started = false;
const listeners = new Set<() => void>();

function load() {
  if (started) return;
  started = true;
  fetchPublicApi<Record<string, number>>('/analytics/views/today', { cache: 'default' })
    .then((map) => {
      counts = map ?? {};
      listeners.forEach((l) => l());
    })
    .catch(() => {
      started = false; // a later page can try again
    });
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  load();
  return () => listeners.delete(listener);
}

export function useTodayViews(listingId: string): number {
  return useSyncExternalStore(
    subscribe,
    () => counts?.[listingId] ?? 0,
    () => 0,
  );
}
