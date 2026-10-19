'use client';

import { useEffect } from 'react';
import { usePathname } from 'next/navigation';
import { captureAttribution } from '@/lib/site/attribution';
import { trackSessionStart } from '@/lib/events';

/** Remembers which campaign link brought this guest (see lib/site/attribution.ts). Renders nothing. */
export function AttributionCapture() {
  const pathname = usePathname();
  useEffect(() => {
    captureAttribution({ search: window.location.search, pathname: window.location.pathname });
    trackSessionStart('other', 'bnb');
  }, [pathname]);
  return null;
}
