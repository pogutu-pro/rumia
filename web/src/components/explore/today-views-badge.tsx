'use client';

import { Eye } from 'lucide-react';
import { cn } from '@/lib/utils/cn';
import { useTodayViews } from '@/hooks/use-today-views';

/** "👁 12 today" on a card photo: how many people looked at this place today. Nothing when no one has yet. */
export function TodayViewsBadge({ listingId, className }: { listingId: string; className?: string }) {
  const n = useTodayViews(listingId);
  if (n <= 0) return null;
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-full bg-black/65 px-2 py-1 text-[11px] font-semibold text-white backdrop-blur-sm',
        className,
      )}
      title={`${n} ${n === 1 ? 'person' : 'people'} viewed this place today`}
    >
      <Eye className="h-3.5 w-3.5" aria-hidden />
      <span aria-hidden>{n} today</span>
      <span className="sr-only">
        {n} {n === 1 ? 'person' : 'people'} viewed today
      </span>
    </span>
  );
}
