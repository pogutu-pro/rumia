'use client';

import { useEffect } from 'react';

interface ListingViewTrackerProps {
  listingId: string;
}

export function ListingViewTracker({ listingId }: ListingViewTrackerProps) {
  useEffect(() => {
    if (!listingId) return;

    void fetch('/api/listing-views', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ listing_id: listingId }),
      keepalive: true,
    }).catch(() => {});
  }, [listingId]);

  return null;
}
