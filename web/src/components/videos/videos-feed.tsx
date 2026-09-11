'use client';

import * as React from 'react';
import Link from 'next/link';
import { Loader2 } from 'lucide-react';
import { VideoItem } from './video-item';
import { VideosEmptyState } from './videos-empty-state';
import {
  listingsClientApi,
  type PaginatedResponse,
} from '@/lib/api/listings-client';
import type { Listing } from '@/types';

interface VideosFeedProps {
  initialListings: Listing[];
  initialPage: number;
  initialPages: number;
  initialError?: boolean;
}

export function VideosFeed({
  initialListings,
  initialPage,
  initialPages,
  initialError = false,
}: VideosFeedProps) {
  const [listings, setListings] = React.useState<Listing[]>(initialListings);
  const [page, setPage] = React.useState(initialPage);
  const [pages, setPages] = React.useState(initialPages);
  const [activeIndex, setActiveIndex] = React.useState(0);
  const [isMuted, setIsMuted] = React.useState(true);
  const [isLoadingMore, setIsLoadingMore] = React.useState(false);
  const [hasInitialError, setHasInitialError] = React.useState(initialError);

  const scrollContainerRef = React.useRef<HTMLDivElement>(null);
  const itemRefs = React.useRef<(HTMLDivElement | null)[]>([]);
  const observerRef = React.useRef<IntersectionObserver | null>(null);
  const loadingRef = React.useRef(false);

  const toggleMute = React.useCallback(() => setIsMuted((m) => !m), []);

  React.useEffect(() => {
    const onFirstGesture = () => setIsMuted(false);
    window.addEventListener('touchstart', onFirstGesture, { once: true, passive: true });
    window.addEventListener('click', onFirstGesture, { once: true });
    return () => {
      window.removeEventListener('touchstart', onFirstGesture);
      window.removeEventListener('click', onFirstGesture);
    };
  }, []);

  const retryInitialLoad = React.useCallback(async () => {
    setIsLoadingMore(true);
    try {
      const res = await listingsClientApi.getFeed({
        has_video: true,
        limit: 10,
        page: 1,
      });
      setListings(res.items);
      setPage(res.page);
      setPages(Math.ceil(res.total / res.limit));
      setActiveIndex(0);
      setHasInitialError(false);
    } catch {
      setHasInitialError(true);
    } finally {
      setIsLoadingMore(false);
    }
  }, []);

  // ── IntersectionObserver for active video detection ─────────────────
  React.useEffect(() => {
    if (observerRef.current) observerRef.current.disconnect();

    observerRef.current = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            const idx = Number((entry.target as HTMLElement).dataset.index);
            if (!isNaN(idx)) setActiveIndex(idx);
          }
        }
      },
      {
        root: scrollContainerRef.current,
        threshold: 0.6,
      },
    );

    itemRefs.current.forEach((el) => {
      if (el) observerRef.current?.observe(el);
    });

    return () => observerRef.current?.disconnect();
  }, [listings.length]);

  // ── Prefetch next page earlier (4 items before end) ────────────────
  React.useEffect(() => {
    if (activeIndex < listings.length - 4) return;
    if (page >= pages) return;
    if (loadingRef.current) return;

    const fetchNext = async () => {
      loadingRef.current = true;
      setIsLoadingMore(true);
      try {
        const nextPage = page + 1;
        const res: PaginatedResponse<Listing> = await listingsClientApi.getFeed(
          {
            has_video: true,
            limit: 10,
            page: nextPage,
          },
        );
        setListings((prev) => {
          const existingIds = new Set(prev.map((l) => String(l.id)));
          const newItems = res.items.filter((l) => !existingIds.has(String(l.id)));
          return [...prev, ...newItems];
        });
        setPage(res.page);
        setPages(Math.ceil(res.total / res.limit));
      } catch {
      } finally {
        setIsLoadingMore(false);
        loadingRef.current = false;
      }
    };

    void fetchNext();
  }, [activeIndex, listings.length, page, pages]);

  // ── Error state ────────────────────────────────────────────────────
  if (hasInitialError && listings.length === 0) {
    return (
      <div className="flex min-h-[calc(100dvh-56px)] flex-col items-center justify-center bg-background px-6 text-center">
        <h2 className="text-xl font-bold text-foreground">Videos are unavailable</h2>
        <p className="mt-2 max-w-sm text-sm leading-relaxed text-muted-foreground">
          We couldn&apos;t load the property videos. Please try again.
        </p>
        <button
          type="button"
          onClick={() => void retryInitialLoad()}
          disabled={isLoadingMore}
          className="mt-6 rounded-full bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-60"
        >
          {isLoadingMore ? 'Retrying…' : 'Try again'}
        </button>
      </div>
    );
  }

  // ── Empty state ────────────────────────────────────────────────────
  if (listings.length === 0) {
    return <VideosEmptyState />;
  }

  // ── Main feed ──────────────────────────────────────────────────────
  return (
    <div className="relative w-full bg-muted">
      {/* Desktop: center the feed in a narrow column */}
      <div
        ref={scrollContainerRef}
        className="mx-auto h-[calc(100dvh-56px)] w-full overflow-y-scroll md:max-w-[480px]"
        style={{
          scrollSnapType: 'y mandatory',
          scrollBehavior: 'smooth',
          scrollbarWidth: 'none',
          msOverflowStyle: 'none',
          WebkitOverflowScrolling: 'touch',
          willChange: 'transform',
        }}
      >
        {listings.map((listing, index) => (
          <div
            key={String(listing.id)}
            ref={(el) => {
              itemRefs.current[index] = el;
            }}
            data-index={index}
            className="snap-start md:py-1"
            style={{ height: 'calc(100dvh - 56px)', scrollSnapAlign: 'start' }}
          >
            <VideoItem
              listing={listing}
              index={index}
              activeIndex={activeIndex}
              isMuted={isMuted}
              onToggleMute={toggleMute}
            />
          </div>
        ))}

        {/* End of feed */}
        {page >= pages && listings.length > 0 && (
          <div className="flex flex-col items-center justify-center bg-background py-12 text-center px-6">
            <p className="text-muted-foreground text-sm font-semibold">
              You&rsquo;ve seen all property videos
            </p>
            <Link
              href="/hostels"
              className="mt-3 inline-flex items-center gap-2 rounded-full border border-border px-4 py-2 text-sm font-semibold text-foreground hover:bg-muted transition-colors"
            >
              Explore all listings
            </Link>
          </div>
        )}
      </div>

      {/* Loading indicator */}
      {isLoadingMore && (
        <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-30 flex items-center gap-2 rounded-full bg-card/90 px-3.5 py-2 backdrop-blur-lg border border-border shadow-lg">
          <Loader2 className="h-3.5 w-3.5 animate-spin text-primary" />
          <span className="text-xs text-foreground font-medium">Loading more…</span>
        </div>
      )}
    </div>
  );
}
