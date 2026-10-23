'use client';

import { useEffect, useLayoutEffect, useState } from 'react';
import { readTaste, type Taste } from '@/lib/personalisation';

const useIsomorphicLayoutEffect = typeof window === 'undefined' ? useEffect : useLayoutEffect;

/**
 * This visitor's on-device taste (areas, kinds and prices they have looked at), or null on the server and for anyone
 * with no history. Read in a layout effect so a personalised order is in place before the first paint: no cards
 * jump, and search engines and first-time visitors get the site-wide order.
 */
export function useTaste(): Taste | null {
  const [taste, setTaste] = useState<Taste | null>(null);
  useIsomorphicLayoutEffect(() => {
    setTaste(readTaste()); // localStorage only exists in the browser, so this can only be read after mount
  }, []);
  return taste;
}
