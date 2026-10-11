'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Globe } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils/cn';

export interface DashboardSwitcherLink {
  href: string;
  label: string;
  icon: LucideIcon;
  show?: boolean;
  exact?: boolean;
}

interface DashboardSwitcherProps {
  /**
   * The dashboards the user can switch to (Manager / Agent / Student / Admin).
   * A link is only rendered when `show` is not false, so users never see a
   * dashboard they are not allowed to access.
   */
  links: DashboardSwitcherLink[];
  /**
   * Section navigation for the current dashboard. Rendered as compact icon
   * buttons on mobile so nothing is hidden behind a dropdown.
   */
  sectionLinks?: DashboardSwitcherLink[];
  className?: string;
}

function isPathActive(pathname: string, href: string, exact?: boolean): boolean {
  if (href === '/') return pathname === '/';
  if (exact) return pathname === href;
  return pathname === href || pathname.startsWith(`${href}/`);
}

const SITE_LINK: DashboardSwitcherLink = {
  href: '/',
  label: 'Site',
  icon: Globe,
};

/**
 * Dashboard portal shortcuts (Manager / Agent / Student / Admin / Site).
 *
 * Desktop: labelled pills for every dashboard the user can access (excluding
 * the one they are already on).
 *
 * Mobile: two horizontally scrollable rows of labelled chips (workspaces, then the
 * current workspace's sections), each at least 44px tall. Primary navigation is the bottom bar.
 */
export function DashboardSwitcher({
  links,
  sectionLinks = [],
  className = '',
}: DashboardSwitcherProps) {
  const pathname = usePathname();

  const accessible = links.filter((l) => l.show !== false);
  const multiDashboard = accessible.length > 1;

  if (!multiDashboard && sectionLinks.length === 0) return null;

  const iconButton = (link: DashboardSwitcherLink) => {
    const active = isPathActive(pathname, link.href, link.exact);
    const Icon = link.icon;
    return (
      <Link
        key={link.href}
        href={link.href}
        aria-current={active ? 'page' : undefined}
        className={cn(
          'inline-flex min-h-11 shrink-0 items-center gap-1.5 rounded-full border px-4 text-sm font-semibold transition-colors',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary',
          active
            ? 'border-primary bg-primary/10 text-primary'
            : 'border-line bg-raised text-ink-muted active:bg-subtle',
        )}
      >
        <Icon className="h-4 w-4 shrink-0" aria-hidden />
        {link.label}
      </Link>
    );
  };

  const pill = (link: DashboardSwitcherLink) => {
    const Icon = link.icon;
    return (
      <Link
        key={link.href}
        href={link.href}
        title={link.label}
        className="inline-flex shrink-0 items-center gap-1.5 rounded-full px-3.5 py-2 text-xs font-semibold transition-colors bg-white text-slate-600 border border-slate-200 shadow-xs hover:border-slate-300 hover:text-slate-900"
      >
        <Icon className="h-3.5 w-3.5 shrink-0" />
        {link.label}
      </Link>
    );
  };

  // Destinations to show on desktop: every accessible dashboard except the
  // current one, plus the public Site.
  const desktopItems = multiDashboard
    ? [
        ...accessible.filter((l) => !isPathActive(pathname, l.href, l.exact)),
        SITE_LINK,
      ]
    : [];

  // Mobile icon bar: every accessible dashboard (current highlighted) plus the
  // public Site, then the current dashboard's section nav icons.
  const mobileDashboards = multiDashboard ? [...accessible, SITE_LINK] : [];

  return (
    <div className={`border-b border-slate-200/80 bg-slate-50/70 ${className}`}>
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        {desktopItems.length > 0 && (
          <nav
            aria-label="Dashboard shortcuts"
            className="hidden md:flex items-center gap-1.5 overflow-x-auto scrollbar-hide py-2.5"
          >
            {desktopItems.map(pill)}
          </nav>
        )}

        {mobileDashboards.length > 0 && (
          <nav
            aria-label="Workspaces"
            className="md:hidden flex items-center gap-2 overflow-x-auto scrollbar-hide py-2"
          >
            {mobileDashboards.map(iconButton)}
          </nav>
        )}
        {sectionLinks.length > 0 && (
          <nav
            aria-label="Sections"
            className="md:hidden flex items-center gap-2 overflow-x-auto scrollbar-hide border-t border-line/70 py-2"
          >
            {sectionLinks.map(iconButton)}
          </nav>
        )}
      </div>
    </div>
  );
}