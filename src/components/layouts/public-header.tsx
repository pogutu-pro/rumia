'use client';

import * as React from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils/cn';
import { InstallButton } from '@/components/pwa/InstallButton';

const NAV_LINKS = [
  { href: '/hostels', label: 'Browse All' },
  { href: '/saved', label: 'Saved' },
  { href: '/auth/login', label: 'Login' },
];

export const PublicHeader = React.memo(function PublicHeader() {
  const pathname = usePathname();
  const isHome = pathname === '/';
  const [isScrolled, setIsScrolled] = React.useState(false);

  React.useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 20);
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  return (
    <>
      <header
        className={cn(
          'fixed top-0 left-0 right-0 z-50 transition-all duration-500 ease-in-out',
          isScrolled
            ? 'bg-white/80 backdrop-blur-md shadow-lg py-2 xs:py-3'
            : isHome
            ? 'bg-transparent py-4 xs:py-6'
            : 'bg-white/90 backdrop-blur-sm py-3 xs:py-5'
        )}
      >
        <div className="container mx-auto px-4 lg:px-8">
          <div className="flex items-center justify-between gap-4">
            {/* Logo */}
            <Link
              href="/"
              className="flex items-center gap-3 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 rounded-sm group shrink-0"
            >
              <div className="relative h-12 w-12 xs:h-14 xs:w-14 overflow-hidden rounded-lg transition-transform group-hover:scale-105">
                <Image
                  src="/images/logo/logo.svg"
                  alt="Rumia Logo"
                  width={56}
                  height={56}
                  priority
                  style={{ height: 'auto' }}
                />
              </div>
              <span className={cn(
                "font-black text-xl tracking-tight transition-colors",
                isScrolled || !isHome ? "text-slate-900" : "text-white"
              )}>
                RUMIA
              </span>
            </Link>

            {/* Center – Quick Links */}
            <nav
              className="hidden lg:flex items-center gap-1"
              aria-label="Main navigation"
            >
              {NAV_LINKS.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    'px-4 py-2 text-sm font-bold rounded-lg transition-colors',
                    pathname.startsWith(item.href)
                      ? isScrolled || !isHome
                        ? 'text-emerald-600 bg-emerald-50'
                        : 'text-white bg-white/10'
                      : isScrolled || !isHome
                        ? 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
                        : 'text-white/80 hover:text-white hover:bg-white/10'
                  )}
                >
                  {item.label}
                </Link>
              ))}
            </nav>

            {/* Install button — top right, all pages, all screen sizes */}
            <div className="shrink-0">
              <InstallButton />
            </div>
          </div>
        </div>
      </header>
      {/* Spacer for fixed header on non-home pages */}
      {!isHome && <div className="h-20" />}
    </>
  );
});
