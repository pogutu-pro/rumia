'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { usePathname } from 'next/navigation';
import { Heart, Menu, Search } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { hasStoredSession } from '@/lib/supabase/client';
import { useWishlistStore } from '@/stores/wishlist-store';

/**
 * The top bar from ux/03 §3.1: wordmark (→ Explore), a search pill on non-Explore pages, Saved with a
 * count, and a menu of the whole seeker site. No bottom tab bar anywhere on public pages.
 */
export function SiteHeader() {
  const pathname = usePathname();
  const [mounted, setMounted] = useState(false);
  const savedCount = useWishlistStore((s) => Object.values(s.saved).filter(Boolean).length);
  const fetchBatch = useWishlistStore((s) => s.fetchBatch);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setMounted(true);
    fetchBatch();
  }, [fetchBatch]);

  const onExplore = pathname === '/';
  const signedIn = mounted && hasStoredSession();
  const menuLabel = signedIn ? 'Account' : 'Sign in';
  const menuHref = signedIn ? '/account' : '/auth/login';

  const count = useMemo(() => (mounted ? savedCount : 0), [mounted, savedCount]);

  return (
    <header className="sticky top-0 z-50 border-b border-rum-line bg-rum-raised">
      <div className="mx-auto flex h-14 max-w-6xl items-center gap-3 px-4 lg:px-8">
        <Link
          href="/"
          aria-label="Rumia — places to rent in Nyeri"
          className="flex shrink-0 items-center gap-2 rounded-rum-control focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rum-accent focus-visible:ring-offset-2"
        >
          <span className="flex h-8 w-8 items-center justify-center overflow-hidden rounded-rum-control">
            <Image src="/images/logo/logo-icon.svg" alt="" width={26} height={26} priority className="h-6 w-6 object-contain" />
          </span>
          <span className="text-lg font-semibold tracking-tight text-rum-text">Rumia</span>
        </Link>

        {!onExplore && (
          <Link
            href="/"
            aria-label="Search places"
            className="hidden min-h-11 flex-1 items-center gap-2 rounded-full border border-rum-line bg-rum-sunken px-4 text-sm text-rum-muted transition-colors hover:bg-rum-surface sm:flex sm:max-w-xs"
          >
            <Search className="h-4 w-4 shrink-0" aria-hidden="true" />
            <span className="truncate">Search places</span>
          </Link>
        )}
        <div className={onExplore ? 'ml-auto flex items-center gap-1' : 'ml-2 flex items-center gap-1 sm:ml-auto'}>
          <Link
            href="/saved"
            aria-label={`Saved places${count > 0 ? ` (${count})` : ''}`}
            className="relative flex h-11 w-11 items-center justify-center rounded-full text-rum-text hover:bg-rum-sunken"
          >
            <Heart className="h-5 w-5" strokeWidth={1.9} aria-hidden="true" />
            {count > 0 && (
              <span
                aria-hidden="true"
                className="absolute bottom-0.5 right-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-rum-accent px-1 text-[11px] font-semibold leading-none text-rum-on-accent"
              >
                {count}
              </span>
            )}
          </Link>

          <DropdownMenu>
            <DropdownMenuTrigger
              aria-label="Menu"
              className="flex h-11 w-11 items-center justify-center rounded-full text-rum-text hover:bg-rum-sunken transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rum-accent focus-visible:ring-offset-2"
            >
              <Menu className="h-5 w-5" strokeWidth={1.9} aria-hidden="true" />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="rounded-rum-media border-rum-line bg-rum-raised p-1 shadow-rum-float">
              <DropdownMenuItem asChild className="min-h-11 cursor-pointer rounded-rum-control px-3 text-base text-rum-text focus:bg-rum-sunken focus:text-rum-text">
                <Link href="/saved">Saved</Link>
              </DropdownMenuItem>
              <DropdownMenuItem asChild className="min-h-11 cursor-pointer rounded-rum-control px-3 text-base text-rum-text focus:bg-rum-sunken focus:text-rum-text">
                <Link href="/saved?tab=alerts">Alerts</Link>
              </DropdownMenuItem>
              <DropdownMenuItem asChild className="min-h-11 cursor-pointer rounded-rum-control px-3 text-base text-rum-text focus:bg-rum-sunken focus:text-rum-text">
                <Link href="/workspace">List your property</Link>
              </DropdownMenuItem>
              <DropdownMenuItem asChild className="min-h-11 cursor-pointer rounded-rum-control px-3 text-base text-rum-text focus:bg-rum-sunken focus:text-rum-text">
                <Link href="/help">Help &amp; safety</Link>
              </DropdownMenuItem>
              <DropdownMenuItem asChild className="min-h-11 cursor-pointer rounded-rum-control px-3 text-base text-rum-text focus:bg-rum-sunken focus:text-rum-text">
                <Link href={menuHref}>{menuLabel}</Link>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </header>
  );
}