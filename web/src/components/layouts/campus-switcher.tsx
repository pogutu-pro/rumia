'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { ChevronDown, GraduationCap } from 'lucide-react';
import { cn } from '@/lib/utils/cn';
import type { Campus } from '@/types';

interface CampusSwitcherProps {
  campuses: Campus[];
  tone?: 'light' | 'dark';
}

function campusUrl(campus: Campus): string {
  return `/hostels/${campus.city.toLowerCase()}/${campus.slug}`;
}

export function CampusSwitcher({ campuses, tone = 'light' }: CampusSwitcherProps) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (ref.current && !ref.current.contains(event.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Current campus slug from /hostels/{county}/{area}/… — the area segment is
  // the campus slug under the generalized routing scheme.
  const match = pathname.match(/^\/hostels\/[^/]+\/([^/]+)/);
  const current =
    campuses.find((c) => c.slug === match?.[1]) ??
    campuses.find((c) => c.status === 'active') ??
    campuses[0];

  const onDark = tone === 'dark';

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="listbox"
        aria-expanded={open}
        className={cn(
          'inline-flex items-center gap-1.5 rounded-xl px-3 py-2 text-sm font-bold transition-all duration-200 cursor-pointer',
          onDark
            ? 'text-white/90 hover:text-white hover:bg-white/10'
            : 'text-slate-700 hover:text-slate-900 hover:bg-slate-100',
        )}
      >
        <GraduationCap className="h-4 w-4" />
        <span className="max-w-28 truncate">{current?.short_name ?? current?.name}</span>
        <ChevronDown
          className={cn('h-3.5 w-3.5 transition-transform', open && 'rotate-180')}
        />
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-2 w-64 overflow-hidden rounded-2xl border border-slate-100 bg-white shadow-xl shadow-slate-900/10">
          <div className="border-b border-slate-100 px-4 py-2.5 text-[10px] font-bold uppercase tracking-wider text-slate-400">
            Campuses
          </div>
          <ul role="listbox" className="max-h-72 overflow-y-auto py-1">
            {campuses.map((campus) => {
              const isActive = campus.status === 'active';
              const isCurrent = current?.slug === campus.slug;
              return (
                <li key={campus.id}>
                  {isActive ? (
                    <Link
                      href={campusUrl(campus)}
                      onClick={() => setOpen(false)}
                      className={cn(
                        'flex items-center justify-between gap-2 px-4 py-2.5 text-sm font-semibold transition-colors',
                        isCurrent
                          ? 'bg-emerald-50 text-emerald-700'
                          : 'text-slate-700 hover:bg-slate-50',
                      )}
                    >
                      <span className="truncate">{campus.short_name ?? campus.name}</span>
                      {isCurrent && (
                        <span className="shrink-0 rounded-full bg-emerald-600 px-2 py-0.5 text-[10px] font-bold text-white">
                          Current
                        </span>
                      )}
                    </Link>
                  ) : (
                    <span className="flex cursor-not-allowed items-center justify-between gap-2 px-4 py-2.5 text-sm font-semibold text-slate-400">
                      <span className="truncate">{campus.short_name ?? campus.name}</span>
                      <span className="shrink-0 rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-bold text-slate-500">
                        Coming soon
                      </span>
                    </span>
                  )}
                </li>
              );
            })}
          </ul>
          <Link
            href="/#campuses"
            onClick={() => setOpen(false)}
            className="block border-t border-slate-100 bg-slate-50 px-4 py-2.5 text-center text-xs font-bold text-emerald-600 hover:bg-emerald-50 transition-colors"
          >
            All universities
          </Link>
        </div>
      )}
    </div>
  );
}
