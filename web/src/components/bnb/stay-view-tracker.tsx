'use client';

import { useEffect } from 'react';
import { referrerKind, track } from '@/lib/events';

/** Counts a view of a stay (shown to its host as "views"). */
export function StayViewTracker({ listingId }: { listingId: string }) {
  useEffect(() => {
    track('property_opened', { surface: 'property', listingId, props: { product: 'bnb', referrer: referrerKind() } });
  }, [listingId]);
  return null;
}
