'use client';

import * as React from 'react';
import { listingsClientApi } from '@/lib/api/listings-client';
import type { Listing } from '@/types';
import { BNB_SEPARATE } from '@/lib/site/separation';

const OPEN_KEY = 'rumia:videos:open';
const PAGE_SIZE = 10;

type Status = 'idle' | 'loading' | 'ready' | 'error';

interface VideoContextValue {
  isOpen: boolean;
  openDrawer: () => void;
  closeDrawer: () => void;
  toggleDrawer: () => void;
  videos: Listing[];
  status: Status;
  hasMore: boolean;
  loadingMore: boolean;
  activeId: string | null;
  select: (id: string) => void;
  /** Fetches the first page the first time it is needed; later calls are no-ops. */
  ensureLoaded: () => void;
  retry: () => void;
  loadMore: () => void;
}

const VideoContext = React.createContext<VideoContextValue | null>(null);

/** Only listings that really have a video, once each. */
function withVideo(items: Listing[], existing: Listing[] = []): Listing[] {
  const seen = new Set(existing.map((l) => String(l.id)));
  return items.filter((l) => {
    const id = String(l.id);
    if (!l.youtube_id || seen.has(id)) return false;
    // Short-stay tours belong to RumiaBnB once the products are separated.
    if (BNB_SEPARATE && l.property_type === 'short_stay') return false;
    seen.add(id);
    return true;
  });
}

export function VideoProvider({ children }: { children: React.ReactNode }) {
  // Open by default (it only shows on wide screens). Closing it is remembered per browser.
  const [isOpen, setIsOpen] = React.useState(true);
  const [videos, setVideos] = React.useState<Listing[]>([]);
  const [status, setStatus] = React.useState<Status>('idle');
  const [page, setPage] = React.useState(0);
  const [pages, setPages] = React.useState(1);
  const [loadingMore, setLoadingMore] = React.useState(false);
  const [activeId, setActiveId] = React.useState<string | null>(null);
  const busy = React.useRef(false);

  React.useEffect(() => {
    try {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      if (localStorage.getItem(OPEN_KEY) === '0') setIsOpen(false);
    } catch {
      /* storage unavailable: keep the default */
    }
  }, []);

  const persist = (value: boolean) => {
    try {
      localStorage.setItem(OPEN_KEY, value ? '1' : '0');
    } catch {
      /* ignore */
    }
  };
  const openDrawer = React.useCallback(() => {
    setIsOpen(true);
    persist(true);
  }, []);
  const closeDrawer = React.useCallback(() => {
    setIsOpen(false);
    persist(false);
  }, []);
  const toggleDrawer = React.useCallback(() => {
    setIsOpen((v) => {
      persist(!v);
      return !v;
    });
  }, []);

  const fetchPage = React.useCallback(async (target: number) => {
    const res = await listingsClientApi.getFeed({ has_video: true, limit: PAGE_SIZE, page: target });
    setPage(res.page);
    setPages(Math.max(1, Math.ceil(res.total / res.limit)));
    return res.items;
  }, []);

  const ensureLoaded = React.useCallback(() => {
    if (busy.current || status === 'ready' || status === 'loading') return;
    busy.current = true;
    setStatus('loading');
    fetchPage(1)
      .then((items) => {
        const list = withVideo(items);
        setVideos(list);
        setActiveId((cur) => cur ?? (list[0] ? String(list[0].id) : null));
        setStatus('ready');
      })
      .catch(() => setStatus('error'))
      .finally(() => {
        busy.current = false;
      });
  }, [fetchPage, status]);

  const retry = React.useCallback(() => {
    setStatus('idle');
    busy.current = false;
  }, []);

  const loadMore = React.useCallback(() => {
    if (busy.current || page >= pages || status !== 'ready') return;
    busy.current = true;
    setLoadingMore(true);
    fetchPage(page + 1)
      .then((items) => setVideos((prev) => [...prev, ...withVideo(items, prev)]))
      .catch(() => {
        /* keep what is shown; the sentinel retries on the next scroll */
      })
      .finally(() => {
        busy.current = false;
        setLoadingMore(false);
      });
  }, [fetchPage, page, pages, status]);

  const select = React.useCallback((id: string) => setActiveId(id), []);

  const value = React.useMemo<VideoContextValue>(
    () => ({
      isOpen,
      openDrawer,
      closeDrawer,
      toggleDrawer,
      videos,
      status,
      hasMore: page < pages,
      loadingMore,
      activeId,
      select,
      ensureLoaded,
      retry,
      loadMore,
    }),
    [isOpen, openDrawer, closeDrawer, toggleDrawer, videos, status, page, pages, loadingMore, activeId, select, ensureLoaded, retry, loadMore],
  );

  return <VideoContext.Provider value={value}>{children}</VideoContext.Provider>;
}

export function useVideos(): VideoContextValue {
  const ctx = React.useContext(VideoContext);
  if (!ctx) throw new Error('useVideos must be used inside <VideoProvider>');
  return ctx;
}

/** For components (like the sidebar) that may render outside the provider. */
export function useOptionalVideos(): VideoContextValue | null {
  return React.useContext(VideoContext);
}
