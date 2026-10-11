'use client';

import Link from 'next/link';
import { usePathname, useSearchParams } from 'next/navigation';
import { cn } from '@/lib/utils/cn';

type Key = 'all' | 'hostel' | 'short_stay' | 'apartment';

const TABS: Array<{ key: Key; label: string }> = [
  { key: 'all', label: 'All' },
  { key: 'hostel', label: 'Hostels' },
  { key: 'short_stay', label: 'Short stays' },
  { key: 'apartment', label: 'Apartments' },
];

/**
 * Category switch for Explore. Short stays live at /bnb; everything else is /hostels with ?type=.
 * Other filters in the URL (search text, price, ...) travel with the switch between /hostels categories.
 */
export function CategoryTabs() {
  const pathname = usePathname();
  const params = useSearchParams();
  const onBnb = pathname === '/bnb';
  const current: Key = onBnb ? 'short_stay' : ((params.get('type') as Key | null) ?? 'all');

  const hrefFor = (key: Key) => {
    if (key === 'short_stay') return '/bnb';
    const next = new URLSearchParams(onBnb ? '' : params.toString());
    if (key === 'all') next.delete('type');
    else next.set('type', key);
    const qs = next.toString();
    return qs ? `/hostels?${qs}` : '/hostels';
  };

  return (
    <nav aria-label="Property category" className="-mx-4 overflow-x-auto px-4 py-3 scrollbar-none lg:-mx-8 lg:px-8">
      <ul className="flex gap-2">
        {TABS.map(({ key, label }) => {
          const active = current === key;
          return (
            <li key={key} className="shrink-0">
              <Link
                href={hrefFor(key)}
                replace
                scroll={false}
                aria-current={active ? 'page' : undefined}
                className={cn(
                  'inline-flex min-h-11 items-center rounded-full border px-4 text-sm font-semibold transition-colors',
                  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary',
                  active
                    ? 'border-primary bg-primary text-primary-foreground'
                    : 'border-line bg-raised text-ink active:bg-subtle',
                )}
              >
                {label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
