'use client';

import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { BedDouble, CalendarRange, Home, LayoutGrid, Play } from 'lucide-react';
import { parseSearch, searchQuery, STAY_TYPES, type StayType } from '@/lib/site/stay-search';
import { cn } from '@/lib/utils/cn';

const ICONS: Record<StayType, typeof Home> = { all: LayoutGrid, entire: Home, room: BedDouble, video: Play, long: CalendarRange };

/** Kinds of stay, as icon tabs under the header. Keeps the rest of the search (place, dates, guests). */
export function CategoryBar({ base = '/stays' }: { base?: string }) {
  const params = useSearchParams();
  const s = parseSearch(params);
  return (
    <nav aria-label="Kind of stay" className="-mx-4 overflow-x-auto px-4 [scrollbar-width:none] md:mx-0 md:px-0 [&::-webkit-scrollbar]:hidden">
      <ul className="flex gap-6 sm:gap-9">
        {STAY_TYPES.map(({ key, label }) => {
          const Icon = ICONS[key];
          const active = s.type === key;
          return (
            <li key={key} className="shrink-0">
              <Link
                href={`${key === 'all' && base === '/' ? '/' : '/stays'}${searchQuery({ ...s, type: key })}`}
                scroll={false}
                aria-current={active ? 'page' : undefined}
                className={cn(
                  'flex flex-col items-center gap-1.5 border-b-2 pb-3 pt-1 text-xs font-semibold transition-colors',
                  active ? 'border-bnb-ink text-bnb-ink' : 'border-transparent text-bnb-stone hover:border-bnb-line hover:text-bnb-ink',
                )}
              >
                <Icon className="h-6 w-6" strokeWidth={1.6} aria-hidden />
                {label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
