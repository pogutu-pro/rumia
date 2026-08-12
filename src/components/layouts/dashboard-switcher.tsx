'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import type { LucideIcon } from 'lucide-react';

export interface DashboardSwitcherLink {
  href: string;
  label: string;
  icon: LucideIcon;
  show?: boolean;
}

interface DashboardSwitcherProps {
  links: DashboardSwitcherLink[];
  className?: string;
}

/**
 * Dashboard portal shortcuts (Manager / Agent / Student) rendered as a
 * labelled pill row below the page header. The shortcut for the dashboard the
 * user is already on is omitted as redundant, and labelled pills always show
 * their destination name and scroll horizontally on small screens — far
 * clearer than cramming icon-only buttons into the header.
 */
export function DashboardSwitcher({
  links,
  className = '',
}: DashboardSwitcherProps) {
  const pathname = usePathname();

  const items = links.filter((l) => {
    if (l.show === false) return false;
    const isCurrentDashboard =
      pathname === l.href || (l.href !== '/' && pathname.startsWith(l.href));
    return !isCurrentDashboard;
  });

  if (items.length === 0) return null;

  return (
    <div className={`border-b border-slate-200/80 bg-slate-50/70 ${className}`}>
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        <nav
          aria-label="Dashboard shortcuts"
          className="flex items-center gap-1.5 overflow-x-auto scrollbar-hide py-2.5"
        >
          {items.map(({ href, label, icon: Icon }) => (
            <Link
              key={href}
              href={href}
              title={label}
              className="inline-flex shrink-0 items-center gap-1.5 rounded-full px-3.5 py-2 text-xs font-semibold transition-colors bg-white text-slate-600 border border-slate-200 shadow-xs hover:border-slate-300 hover:text-slate-900"
            >
              <Icon className="h-3.5 w-3.5 shrink-0" />
              {label}
            </Link>
          ))}
        </nav>
      </div>
    </div>
  );
}