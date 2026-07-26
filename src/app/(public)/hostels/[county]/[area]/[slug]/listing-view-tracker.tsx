'use client';

import { useEffect } from 'react';
import { recordRecentlyViewedHostel } from '@/lib/utils/recently-viewed';
import posthog from 'posthog-js';

interface ListingViewTrackerProps {
  listingId: string;
  title?: string;
  price?: number;
  location?: string;
  slug?: string;
  county?: string;
  area?: string;
  imageUrl?: string;
}

export function ListingViewTracker({
  listingId,
  title,
  price,
  location,
  slug,
  county,
  area,
  imageUrl,
}: ListingViewTrackerProps) {
  useEffect(() => {
    if (!listingId) return;

    // Record server-side view count
    void fetch('/api/listing-views', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ listing_id: listingId }),
      keepalive: true,
    }).catch(() => {});

    // Record client-side recently viewed
    if (title && price != null && location && slug) {
      recordRecentlyViewedHostel({
        id: listingId,
        title,
        price,
        location,
        slug,
        county,
        area,
        imageUrl,
      });
    }

    posthog.capture('listing_viewed', {
      listing_id: listingId,
      listing_zone: area ?? null,
      listing_county: county ?? null,
    });
  }, [listingId, title, price, location, slug, county, area, imageUrl]);

  return null;
}
