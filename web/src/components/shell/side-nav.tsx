'use client';

import * as React from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useOptionalVideos } from '@/components/videos/video-provider';
import { ChevronsLeft, ChevronsRight } from 'lucide-react';
import { cn } from '@/lib/utils/cn';
import { useMediaQuery } from '@/hooks/use-media-query';
import { useWishlistStore } from '@/stores/wishlist-store';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { LEGAL_NAV, PRIMARY_NAV, isNavActive } from './nav-config';
import { useShell } from './shell-provider';

export function BrandLink({ compact, onNavigate }: { compact?: boolean; onNavigate?: () => void }) {
  return (
    <Link
      href="/"
      aria-label="Rumia home"
      onClick={onNavigate}
      className="flex h-11 min-w-11 items-center justify-center gap-2 rounded-lg px-1 lg:h-10 lg:min-w-0 lg:justify-start focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
    >
      <Image src="/images/logo/logo-icon.svg" alt="" width={28} height={28} priority unoptimized className="h-7 w-7 shrink-0" />
      {!compact && <span className="font-heading text-xl font-extrabold tracking-tight text-ink">Rumia</span>}
    </Link>
  );
}

interface NavListProps {
  compact?: boolean;
  onNavigate?: () => void;
}

export function NavList({ compact = false, onNavigate }: NavListProps) {
  const pathname = usePathname();
  const videos = useOptionalVideos();
  // Width-dependent state is only used after mount so the server HTML and the first client render match.
  const mounted = React.useSyncExternalStore(
    () => () => {},
    () => true,
    () => false,
  );
  const isWide = useMediaQuery('(min-width: 1024px)') && mounted;
  const savedCount = useWishlistStore((s) =>
    s.fetched ? Object.values(s.saved).filter(Boolean).length : 0,
  );

  return (
    <TooltipProvider delayDuration={200}>
      <nav aria-label="Primary" className="flex flex-col gap-1">
        {PRIMARY_NAV.map((item) => {
          const isVideos = item.href === '/videos';
          // On the home page of a wide screen, Videos opens the right-hand drawer instead of leaving the page.
          const drawerMode = isVideos && pathname === '/' && !!videos;
          const active = drawerMode ? !!videos?.isOpen && isWide : isNavActive(pathname, item);
          const Icon = item.icon;
          const count = item.href === '/saved' && savedCount > 0 ? savedCount : 0;
          const link = (
            <Link
              href={item.href}
              onClick={(e) => {
                if (drawerMode && window.matchMedia('(min-width: 1024px)').matches) {
                  e.preventDefault();
                  videos?.toggleDrawer();
                }
                onNavigate?.();
              }}
              aria-current={active ? 'page' : undefined}
              aria-pressed={drawerMode && isWide ? active : undefined}
              aria-label={compact ? item.label : undefined}
              className={cn(
                'relative flex h-11 items-center gap-3 rounded-xl px-3 text-sm font-medium transition-colors',
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary',
                compact && 'justify-center px-0',
                active ? 'bg-primary/10 text-primary' : 'text-ink-muted hover:bg-subtle hover:text-ink',
              )}
            >
              <Icon className="h-5 w-5 shrink-0" strokeWidth={active ? 2.2 : 1.8} aria-hidden />
              {!compact && <span className="truncate">{item.label}</span>}
              {count > 0 && (
                <span
                  className={cn(
                    'flex h-5 min-w-5 items-center justify-center rounded-full bg-primary px-1.5 text-[11px] font-semibold tabular-nums text-primary-foreground',
                    compact ? 'absolute right-1.5 top-1.5 h-4 min-w-4 px-1 text-[10px]' : 'ml-auto',
                  )}
                >
                  <span aria-hidden>{count > 99 ? '99+' : count}</span>
                  <span className="sr-only">{count} saved</span>
                </span>
              )}
            </Link>
          );
          if (!compact) return <React.Fragment key={item.href}>{link}</React.Fragment>;
          return (
            <Tooltip key={item.href}>
              <TooltipTrigger asChild>{link}</TooltipTrigger>
              <TooltipContent side="right">{item.label}</TooltipContent>
            </Tooltip>
          );
        })}
      </nav>
    </TooltipProvider>
  );
}

export function LegalLinks({ onNavigate }: { onNavigate?: () => void }) {
  return (
    <nav aria-label="Legal" className="flex flex-wrap gap-x-4 gap-y-1 px-3 text-xs text-ink-muted">
      {LEGAL_NAV.map((l) => (
        <Link
          key={l.href}
          href={l.href}
          onClick={onNavigate}
          className="rounded underline-offset-2 hover:text-ink hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
        >
          {l.label}
        </Link>
      ))}
    </nav>
  );
}

/** Desktop rail: expanded (labels, legal links) or collapsed to icons. Hidden below `lg`. */
export function SideNav() {
  const { collapsed, setCollapsed } = useShell();
  return (
    <aside
      className={cn(
        'sticky top-0 z-30 hidden h-dvh shrink-0 flex-col border-r border-line bg-raised py-3 transition-[width] duration-200 motion-reduce:transition-none lg:flex',
        collapsed ? 'w-[var(--shell-sidebar-w-collapsed)] px-3' : 'w-[var(--shell-sidebar-w)] px-3',
      )}
    >
      <div className={cn('mb-4 flex h-10 items-center', collapsed ? 'justify-center' : 'px-1')}>
        <BrandLink compact={collapsed} />
      </div>
      <NavList compact={collapsed} />
      <div className="mt-auto flex flex-col gap-3">
        {!collapsed && <LegalLinks />}
        <button
          type="button"
          onClick={() => setCollapsed(!collapsed)}
          aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          aria-expanded={!collapsed}
          className={cn(
            'flex h-10 items-center rounded-xl text-ink-muted transition-colors hover:bg-subtle hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary',
            collapsed ? 'justify-center' : 'px-3',
          )}
        >
          {collapsed ? <ChevronsRight className="h-5 w-5" /> : <ChevronsLeft className="h-5 w-5" />}
        </button>
      </div>
    </aside>
  );
}
