'use client';

import { useEffect, useState } from 'react';
import { Eye } from 'lucide-react';
import { fetchPublicApi } from '@/lib/api/config';

interface Counts {
  today: number;
  week: number;
}

/**
 * "23 people viewed today" under a property's title. Views are recorded by ListingViewTracker (once per visitor,
 * never agents or admins); this only reads the count.
 *
 * Cheap on purpose: one request per page view, no polling, and the API answers repeat reads for a minute from
 * memory. Nothing renders until a real count arrives, and a quiet day falls back to the week rather than "0".
 */
export function ListingViewsToday({ listingId }: { listingId: string }) {
  const [counts, setCounts] = useState<Counts | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetchPublicApi<{ today_count?: number; week_count?: number }>(`/analytics/views/${listingId}`, { cache: 'default' })
      .then((row) => {
        if (!cancelled && row) setCounts({ today: Number(row.today_count) || 0, week: Number(row.week_count) || 0 });
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [listingId]);

  if (!counts) return null;
  const [n, when] = counts.today > 0 ? [counts.today, 'today'] : [counts.week, 'this week'];
  if (n <= 0) return null;

  return (
    <p className="inline-flex items-center gap-1.5 text-sm font-semibold text-slate-600">
      <Eye className="h-4 w-4 text-slate-500" aria-hidden />
      {n.toLocaleString()} {n === 1 ? 'person' : 'people'} viewed {when}
    </p>
  );
}
