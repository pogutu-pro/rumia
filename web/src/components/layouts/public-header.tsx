'use client';

import * as React from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { Heart, Play } from 'lucide-react';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils/cn';
import { NavbarSearch } from '@/components/layouts/navbar-search';

export const PublicHeader = React.memo(function PublicHeader() {
  const [isScrolled, setIsScrolled] = React.useState(false);
  const pathname = usePathname();

  React.useEffect(() => {
    let ticking = false;
    let last = false;
    const onScroll = () => {
      if (!ticking) {
        window.requestAnimationFrame(() => {
          const n = window.scrollY > 8;
          if (n !== last) {
            last = n;
            setIsScrolled(n);
          }
          ticking = false;
        });
        ticking = true;
      }
    };
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  const isVideosActive = pathname === '/videos' || pathname.startsWith('/videos');

  return (
    <>
      <header
        className={cn(
          'fixed inset-x-0 top-0 z-50 h-[56px] border-b transition-[border-color,box-shadow,background-color] duration-150',
          isScrolled
            ? 'border-slate-200 bg-white shadow-[0_1px_8px_rgba(15,23,42,0.06)]'
            : 'border-slate-100 bg-white',
        )}
      >
        <div className="mx-auto flex h-full max-w-6xl items-center gap-3 px-4 lg:px-8">
          <Link
            href="/"
            aria-label="Rumia Home"
            className="flex shrink-0 items-center gap-2 rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600 focus-visible:ring-offset-2"
          >
            <span className="flex h-8 w-8 items-center justify-center overflow-hidden rounded-xl bg-emerald-50 ring-1 ring-emerald-100">
              <Image
                src="/images/logo/logo-icon.svg"
                alt="Rumia"
                width={20}
                height={20}
                priority
                className="h-5 w-5 object-contain"
              />
            </span>
            <span className="font-heading text-[17px] font-extrabold tracking-tight text-slate-900">
              Rumia
            </span>
          </Link>

          <div className="flex min-w-0 flex-1 justify-center px-2 sm:px-4">
            <React.Suspense
              fallback={
                <div className="h-11 w-full max-w-[420px] rounded-full border border-slate-200 bg-slate-50" />
              }
            >
              <NavbarSearch />
            </React.Suspense>
          </div>

          <div className="flex shrink-0 items-center gap-1">
            {/* Videos link — desktop only */}
            <Link
              href="/videos"
              aria-label="Property Videos"
              className={cn(
                'hidden items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold transition-colors md:inline-flex',
                isVideosActive
                  ? 'bg-emerald-50 text-emerald-700'
                  : 'text-slate-700 hover:bg-slate-100 hover:text-slate-900',
              )}
            >
              <Play
                className={cn(
                  'h-4 w-4',
                  isVideosActive ? 'text-emerald-600 fill-emerald-600' : 'text-slate-600',
                )}
                strokeWidth={isVideosActive ? 0 : 1.9}
              />
              Videos
            </Link>

            <Link
              href="/saved"
              aria-label="Wishlist"
              className="hidden items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-100 hover:text-slate-900 md:inline-flex"
            >
              <Heart className="h-4 w-4 text-slate-600" strokeWidth={1.9} />
              Wishlist
            </Link>

            <Link
              href="/saved"
              aria-label="Wishlist"
              className="inline-flex h-9 w-9 items-center justify-center rounded-full text-slate-700 hover:bg-slate-100 hover:text-slate-900 md:hidden"
            >
              <Heart className="h-[18px] w-[18px]" strokeWidth={1.9} />
            </Link>
          </div>
        </div>
      </header>
      <div className="h-[56px]" />
    </>
  );
});
