'use client';

import { useEffect, useState } from 'react';
import { Eye } from 'lucide-react';
import { fetchPublicApi } from '@/lib/api/config';

interface Counts {
  today: number;
  week: number;
  month: number;
  allTime: number;
}

const toCount = (v: unknown) => (Number.isFinite(Number(v)) ? Number(v) : 0);

/**
 * The property page's visitor line, as it was: "23 views today · 140 this week · 512 this month · 1,946 since listed".
 * Views are recorded by ListingViewTracker (once per visitor, never agents or admins); this only reads them.
 *
 * Cheap on purpose: one request per page view and no polling (the old version re-read every minute per open tab);
 * the API answers repeat reads for a minute from memory.
 */
export function ListingViewCountsLine({ listingId }: { listingId: string }) {
  const [counts, setCounts] = useState<Counts | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetchPublicApi<Record<string, unknown>>(`/analytics/views/${listingId}`, {
      cache: 'default',
    })
      .then((row) => {
        if (cancelled || !row) return;
        setCounts({
          today: toCount(row.today_count),
          week: toCount(row.week_count),
          month: toCount(row.month_count),
          allTime: toCount(row.all_time_count),
        });
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [listingId]);

  if (!counts) return null;
  return (
    <p className="flex items-start gap-1.5 text-sm font-bold text-blue-700">
      <Eye className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
      <span>
        {[
          `${counts.today.toLocaleString()} views today`,
          `${counts.week.toLocaleString()} this week`,
          `${counts.month.toLocaleString()} this month`,
          `${counts.allTime.toLocaleString()} since listed`,
        ].join(' · ')}
      </span>
    </p>
  );
}
