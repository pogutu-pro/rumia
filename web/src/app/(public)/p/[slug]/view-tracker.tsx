'use client';

import { useEffect } from 'react';
import { track } from '@/lib/events';
import { rememberViewed } from '@/lib/rumia/memory';

/** Records that this place was opened and how long it stayed in view (bucketed, no scroll tracking). */
export function PropertyViewTracker({ propertyId, listingId }: { propertyId: string; listingId?: string | null }) {
  useEffect(() => {
    if (listingId) rememberViewed(listingId);
    track('property_opened', { surface: 'property', listingId: propertyId });
    const started = Date.now();
    const send = () => {
      const seconds = Math.round((Date.now() - started) / 1000);
      if (seconds >= 3) track('property_dwell', { surface: 'property', listingId: propertyId, props: { seconds: seconds < 10 ? 5 : seconds < 30 ? 15 : seconds < 120 ? 60 : 180 } });
    };
    document.addEventListener('visibilitychange', () => document.visibilityState === 'hidden' && send(), { once: true });
    return send;
  }, [propertyId, listingId]);
  return null;
}
