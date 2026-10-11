'use client';

import * as React from 'react';
import { usePathname } from 'next/navigation';
import { useMediaQuery } from '@/hooks/use-media-query';
import { VideoPanel } from './video-panel';
import { useVideos } from './video-provider';

/**
 * Persistent right-hand drawer for the home page on screens 1024px wide and up. It sits under the shared header
 * and scrolls on its own. The column is reserved in the server HTML so the page does not jump when it appears;
 * the player and its data load only after mount and only on a wide screen. Below 1024px the Videos entry opens the
 * full-screen /videos page instead. If there are no videos at all, the drawer removes itself.
 */
export function HomeVideoDrawer() {
  const pathname = usePathname();
  const { isOpen, closeDrawer, status, videos } = useVideos();
  // Only trust the screen width after mount, so the first client render matches the server HTML.
  const mounted = React.useSyncExternalStore(
    () => () => {},
    () => true,
    () => false,
  );
  const wide = useMediaQuery('(min-width: 1024px)') && mounted;
  if (pathname !== '/' || !isOpen) return null;
  if (status === 'ready' && videos.length === 0) return null;
  return (
    <aside
      aria-label="Rumia Videos"
      className="sticky top-[var(--shell-header-h)] hidden h-[calc(100dvh-var(--shell-header-h))] w-[22rem] shrink-0 border-l border-line lg:block xl:w-[24rem]"
    >
      {wide && <VideoPanel variant="drawer" onClose={closeDrawer} />}
    </aside>
  );
}
