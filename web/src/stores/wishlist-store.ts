'use client';

import { create } from 'zustand';
import { apiClient } from '@/lib/api/client';
import { createClient } from '@/lib/supabase/client';

/**
 * Wishlist Store — batches N individual wishlist-check calls into one POST.
 *
 * Components call `requestCheck(listingId)` to register interest.
 * The store debounces 50 ms, collects all pending IDs, then fires a single
 * POST /profiles/me/wishlist/batch-check. Results are distributed to every
 * subscriber via the `saved` map.
 *
 * This replaces the previous N+1 pattern where each SaveButton fired its own
 * GET /profiles/me/wishlist/{id} — the root cause of the 503 flood.
 */

interface BatchCheckResponse {
  saved: Record<string, boolean>;
}

interface WishlistState {
  /** Map of listing_id → is_saved (only populated after a batch check). */
  saved: Record<string, boolean>;

  /** True while a batch request is in flight. */
  loading: boolean;

  /** Track whether we've done at least one fetch this session. */
  fetched: boolean;

  /** Register interest in a listing ID. Triggers a debounced batch fetch. */
  requestCheck: (listingId: string) => void;

  /** Optimistically set saved state for a single listing (after toggle). */
  setSaved: (listingId: string, value: boolean) => void;

  /** Force a batch fetch for specific IDs (bypasses debounce). */
  fetchBatch: (ids: string[]) => Promise<void>;

  /** Reset the store (e.g. on logout). */
  reset: () => void;
}

// ── Module-level batching state (shared across all subscribers) ──────────────
let pendingIds = new Set<string>();
let debounceTimer: ReturnType<typeof setTimeout> | null = null;
let currentController: AbortController | null = null;

export const useWishlistStore = create<WishlistState>()((set, get) => {

  async function executeBatch(ids: string[]) {
    if (ids.length === 0) return;

    // Don't fire if user isn't logged in
    const supabase = createClient();
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.user) return;

    // Abort any in-flight batch
    currentController?.abort();
    currentController = new AbortController();

    set({ loading: true });

    try {
      const res = await apiClient<BatchCheckResponse>(
        '/profiles/me/wishlist/batch-check',
        {
          method: 'POST',
          body: JSON.stringify({ ids }),
          signal: currentController.signal,
        },
      );

      // Merge results into existing saved map
      set((state) => ({
        saved: { ...state.saved, ...res.saved },
        loading: false,
        fetched: true,
      }));
    } catch {
      // Network error / abort — silently degrade. Don't clear existing state.
      set({ loading: false });
    }
  }

  function scheduleBatch() {
    if (debounceTimer) clearTimeout(debounceTimer);

    debounceTimer = setTimeout(() => {
      const ids = Array.from(pendingIds);
      pendingIds.clear();
      debounceTimer = null;

      // Filter out IDs we already know the state of
      const unknown = ids.filter((id) => !(id in get().saved));
      if (unknown.length > 0) {
        executeBatch(unknown);
      }
    }, 50); // 50ms debounce — fast enough to feel instant, long enough to batch
  }

  return {
    saved: {},
    loading: false,
    fetched: false,

    requestCheck: (listingId: string) => {
      // If we already know this ID's state, skip
      if (listingId in get().saved) return;

      pendingIds.add(listingId);
      scheduleBatch();
    },

    setSaved: (listingId: string, value: boolean) => {
      set((state) => ({
        saved: { ...state.saved, [listingId]: value },
      }));
    },

    fetchBatch: async (ids: string[]) => {
      await executeBatch(ids);
    },

    reset: () => {
      currentController?.abort();
      if (debounceTimer) clearTimeout(debounceTimer);
      pendingIds.clear();
      set({ saved: {}, loading: false, fetched: false });
    },
  };
});
