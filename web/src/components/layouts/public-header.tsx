'use client';

import * as React from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { Heart, Search, User, X } from 'lucide-react';
import { cn } from '@/lib/utils/cn';
import { createClient } from '@/lib/supabase/client';
import { CampusSwitcher } from '@/components/layouts/campus-switcher';
import type { Campus } from '@/types';

interface PublicHeaderProps {
  campuses?: Campus[];
}

export const PublicHeader = React.memo(function PublicHeader({
  campuses = [],
}: PublicHeaderProps) {
  const router = useRouter();
  const [isScrolled, setIsScrolled] = React.useState(false);
  const [userName, setUserName] = React.useState<string | null>(null);
  const [query, setQuery] = React.useState('');

  React.useEffect(() => {
    const handleScroll = () => setIsScrolled(window.scrollY > 8);
    handleScroll();
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  React.useEffect(() => {
    let active = true;
    (async () => {
      const {
        data: { user },
      } = await createClient().auth.getUser();
      if (active && user) {
        setUserName(user.email?.split('@')[0] ?? user.id?.slice(0, 2) ?? 'U');
      }
    })();
    return () => {
      active = false;
    };
  }, []);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = query.trim();
    if (trimmed) {
      router.push(`/hostels?q=${encodeURIComponent(trimmed)}`);
    } else {
      router.push('/hostels');
    }
  };

  const initials = userName ? userName.slice(0, 2).toUpperCase() : null;

  return (
    <>
      <header
        className={cn(
          'fixed inset-x-0 top-0 z-50 h-16 xs:h-[68px] transition-all duration-300',
          isScrolled
            ? 'border-b border-slate-100 bg-white/90 shadow-xs backdrop-blur-md'
            : 'border-b border-slate-100/60 bg-white/70 backdrop-blur-xs',
        )}
      >
        <div className="mx-auto h-full max-w-6xl px-3 sm:px-4 lg:px-8">
          <div className="flex h-full items-center justify-between gap-1.5 xs:gap-2 sm:gap-4">
            {/* LEFT: Logo & Branding */}
            <div className="flex shrink-0 items-center">
              <Link
                href="/"
                aria-label="Rumia Home"
                className="group flex items-center gap-1.5 xs:gap-2 rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600 focus-visible:ring-offset-2 touch-manipulation"
              >
                <span className="flex h-8 w-8 xs:h-8.5 xs:w-8.5 sm:h-9 sm:w-9 items-center justify-center overflow-hidden rounded-xl bg-emerald-50 ring-1 ring-emerald-100 transition-transform duration-300 group-hover:scale-105">
                  <Image
                    src="/images/logo/logo-icon.svg"
                    alt="Rumia logo"
                    width={22}
                    height={22}
                    priority
                    sizes="24px"
                    className="h-5 w-5 xs:h-5.5 xs:w-5.5 sm:h-6 sm:w-6 object-contain"
                  />
                </span>
                <span className="font-heading text-base xs:text-lg sm:text-xl font-extrabold leading-none tracking-tight text-slate-900">
                  Rumia
                </span>
              </Link>
            </div>

            {/* CENTER: Global Centered Search Bar */}
            <div className="flex min-w-0 flex-1 items-center justify-center px-1 sm:px-3">
              <form
                onSubmit={handleSearchSubmit}
                role="search"
                className="relative w-full max-w-[200px] xs:max-w-[260px] sm:max-w-sm md:max-w-md"
              >
                <Search className="pointer-events-none absolute left-2.5 xs:left-3 top-1/2 h-3.5 w-3.5 xs:h-4 xs:w-4 -translate-y-1/2 text-slate-400" />
                <input
                  type="search"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Search places..."
                  enterKeyHint="search"
                  autoComplete="off"
                  className="h-9 xs:h-9.5 sm:h-10 w-full rounded-full border border-slate-200 bg-slate-50/90 pl-8 xs:pl-9 pr-7 xs:pr-8 text-xs xs:text-sm font-medium text-slate-900 placeholder:text-slate-400 transition-all duration-200 hover:border-slate-300 hover:bg-white focus:border-emerald-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20 touch-manipulation"
                />
                {query ? (
                  <button
                    type="button"
                    onClick={() => setQuery('')}
                    aria-label="Clear search query"
                    className="absolute right-2 xs:right-2.5 top-1/2 -translate-y-1/2 rounded-full p-1 text-slate-400 hover:text-slate-600 touch-manipulation"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                ) : null}
              </form>
            </div>

            {/* RIGHT: Campus Switcher, Wishlist, Account */}
            <div className="flex shrink-0 items-center gap-0.5 xs:gap-1 sm:gap-1.5">
              <div className="hidden md:block">
                <CampusSwitcher campuses={campuses} tone="light" />
              </div>

              <Link
                href="/verify"
                className="hidden lg:inline-flex rounded-full px-3 py-1.5 text-xs font-bold text-slate-600 hover:bg-slate-100 hover:text-slate-900 transition-colors"
              >
                Verify
              </Link>

              <Link
                href="/saved"
                aria-label="Wishlist"
                className="inline-flex h-9 min-w-[34px] xs:min-w-[36px] sm:min-w-0 items-center justify-center gap-1.5 rounded-full px-1.5 xs:px-2 sm:px-3 text-xs sm:text-[13px] font-bold text-slate-700 transition-colors hover:bg-slate-100 hover:text-slate-900 touch-manipulation"
              >
                <Heart className="h-4 w-4 text-slate-600" />
                <span className="hidden sm:inline">Wishlist</span>
              </Link>

              {initials ? (
                <Link
                  href="/account"
                  aria-label="Account profile"
                  className="flex h-8.5 w-8.5 sm:h-9 sm:w-9 items-center justify-center rounded-full bg-emerald-600 text-xs font-extrabold text-white shadow-xs transition-transform hover:scale-105 touch-manipulation"
                >
                  {initials}
                </Link>
              ) : (
                <Link
                  href="/auth/login"
                  aria-label="Sign in"
                  className="flex h-9 min-w-[34px] xs:min-w-[36px] sm:min-w-0 items-center justify-center gap-1 rounded-full px-1.5 xs:px-2 sm:px-3 text-xs sm:text-[13px] font-bold text-slate-700 transition-colors hover:bg-slate-100 hover:text-slate-900 touch-manipulation"
                >
                  <User className="h-4 w-4" />
                  <span className="hidden sm:inline">Sign in</span>
                </Link>
              )}
            </div>
          </div>
        </div>
      </header>
      {/* Spacer for the fixed header on all pages */}
      <div className="h-16 xs:h-[68px]" />
    </>
  );
});