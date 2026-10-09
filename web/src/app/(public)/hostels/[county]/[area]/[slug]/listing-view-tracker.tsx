'use client';

import { useEffect } from 'react';
import { recordRecentlyViewedHostel } from '@/lib/utils/recently-viewed';
import posthog from 'posthog-js';

const VIEW_TRACKER_KEY = 'rumia_listing_view_tracked';

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

function hasTrackedView(listingId: string): boolean {
  if (typeof window === 'undefined') return false;
  try {
    const stored = sessionStorage.getItem(VIEW_TRACKER_KEY);
    if (!stored) return false;
    const ids = new Set<string>(JSON.parse(stored));
    return ids.has(listingId);
  } catch {
    return false;
  }
}

function markViewTracked(listingId: string): void {
  if (typeof window === 'undefined') return;
  try {
    const stored = sessionStorage.getItem(VIEW_TRACKER_KEY);
    const ids = new Set<string>(stored ? JSON.parse(stored) : []);
    ids.add(listingId);
    sessionStorage.setItem(VIEW_TRACKER_KEY, JSON.stringify([...ids]));
  } catch {
    // Ignore sessionStorage errors
  }
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

    if (!hasTrackedView(listingId)) {
      void fetch('/api/listing-views', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ listing_id: listingId }),
        keepalive: true,
      }).catch(() => {});
      markViewTracked(listingId);
    }

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
