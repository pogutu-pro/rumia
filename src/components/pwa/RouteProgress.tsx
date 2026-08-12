'use client';

import { useEffect, useRef, useState } from 'react';
import { usePathname } from 'next/navigation';

const SAFETY_TIMEOUT = 15000;
const FINISH_DELAY = 400;

export function RouteProgress() {
  const pathname = usePathname();
  const [visible, setVisible] = useState(false);

  const skippedFirst = useRef(false);
  const finishTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const safetyTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  function hideSoon() {
    if (finishTimer.current) clearTimeout(finishTimer.current);
    finishTimer.current = setTimeout(() => setVisible(false), FINISH_DELAY);
  }

  // A route change means the new page has arrived — finish and hide.
  useEffect(() => {
    if (!skippedFirst.current) {
      skippedFirst.current = true;
      return;
    }
    setVisible(true);
    hideSoon();
    return () => {
      if (finishTimer.current) clearTimeout(finishTimer.current);
    };
  }, [pathname]);

  // Show the bar the moment an internal link is tapped so slow networks
  // still get feedback without a full-screen loading page.
  useEffect(() => {
    const isInternal = (href: string) =>
      href.startsWith('/') && !href.startsWith('//') && !href.startsWith('http');

    const onClick = (e: MouseEvent) => {
      const anchor = (e.target as HTMLElement | null)?.closest?.(
        'a[href]',
      ) as HTMLAnchorElement | null;
      if (!anchor) return;
      const href = anchor.getAttribute('href') || '';
      if (
        anchor.target === '_blank' ||
        anchor.hasAttribute('download') ||
        !isInternal(href) ||
        e.metaKey ||
        e.ctrlKey ||
        e.shiftKey ||
        e.altKey
      ) {
        return;
      }
      setVisible(true);
      if (safetyTimer.current) clearTimeout(safetyTimer.current);
      safetyTimer.current = setTimeout(() => setVisible(false), SAFETY_TIMEOUT);
    };

    document.addEventListener('click', onClick, true);
    return () => document.removeEventListener('click', onClick, true);
  }, []);

  if (!visible) return null;

  return (
    <div
      className="pointer-events-none fixed top-0 left-0 right-0 z-[70] h-[3px] overflow-hidden"
      aria-hidden="true"
    >
      <div className="route-progress-bar" />
    </div>
  );
}