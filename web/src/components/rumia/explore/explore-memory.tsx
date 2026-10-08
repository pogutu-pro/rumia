'use client';

import { useEffect } from 'react';
import { rememberSearch } from '@/lib/rumia/memory';

/** Remembers the current search on this device so the next visit can offer to continue it. */
export function ExploreMemory({ href, label, active }: { href: string; label: string; active: boolean }) {
  useEffect(() => {
    if (active) rememberSearch({ href, label, at: Date.now() });
  }, [href, label, active]);
  return null;
}
