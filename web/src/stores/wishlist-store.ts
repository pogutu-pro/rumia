'use client';

import { create } from 'zustand';
import { rumia } from '@/lib/api/rumia';

/**
 * Saved places for this browser (or the signed-in account). One request loads every saved id, so any number
 * of Save buttons on a page cost a single call. Works without an account: the API keys saves to the device.
 */
interface WishlistState {
  /** listing id → is saved. Ids not listed after the first load are known to be unsaved. */
  saved: Record<string, boolean>;
  loading: boolean;
  fetched: boolean;
  requestCheck: (listingId: string) => void;
  setSaved: (listingId: string, value: boolean) => void;
  fetchBatch: (ids?: string[]) => Promise<void>;
  reset: () => void;
}

let inflight: Promise<void> | null = null;

export const useWishlistStore = create<WishlistState>()((set, get) => {
  async function loadAll(): Promise<void> {
    if (inflight) return inflight;
    set({ loading: true });
    inflight = (async () => {
      try {
        const { data } = await rumia.GET('/api/v1/saves');
        const ids = data?.listing_ids ?? [];
        const next: Record<string, boolean> = {};
        for (const id of ids) next[id] = true;
        // Keep optimistic changes made while the request was in flight.
        set((state) => ({ saved: { ...next, ...state.saved }, loading: false, fetched: true }));
      } catch {
        set({ loading: false }); // offline: keep what we know
      } finally {
        inflight = null;
      }
    })();
    return inflight;
  }

  return {
    saved: {},
    loading: false,
    fetched: false,

    requestCheck: (listingId: string) => {
      const { saved, fetched } = get();
      if (listingId in saved) return;
      if (fetched) {
        set((state) => ({ saved: { ...state.saved, [listingId]: false } }));
        return;
      }
      void loadAll();
    },

    setSaved: (listingId: string, value: boolean) => {
      set((state) => ({ saved: { ...state.saved, [listingId]: value } }));
    },

    fetchBatch: async () => {
      await loadAll();
    },

    reset: () => {
      inflight = null;
      set({ saved: {}, loading: false, fetched: false });
    },
  };
});
