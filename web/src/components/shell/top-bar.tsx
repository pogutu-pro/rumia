'use client';

import * as React from 'react';
import { Menu } from 'lucide-react';
import { NavbarSearch } from '@/components/layouts/navbar-search';
import { NotificationBell } from '@/components/notifications/notification-bell';
import { BrandLink } from './side-nav';
import { ProfileMenu } from './profile-menu';
import { useShell } from './shell-provider';

/** The single application header: search (with its filter affordance), notifications, profile. */
export function TopBar() {
  const { auth, setMobileNavOpen } = useShell();
  return (
    <header className="sticky top-0 z-40 flex h-[var(--shell-header-h)] items-center gap-3 border-b border-line bg-raised/95 px-4 backdrop-blur supports-[backdrop-filter]:bg-raised/80 lg:px-8">
      <button
        type="button"
        onClick={() => setMobileNavOpen(true)}
        aria-label="Open navigation menu"
        className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-ink hover:bg-subtle focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary lg:hidden"
      >
        <Menu className="h-5 w-5" />
      </button>
      <div className="lg:hidden">
        <BrandLink compact />
      </div>
      <div className="min-w-0 flex-1 lg:max-w-2xl">
        <React.Suspense fallback={<div className="h-11 w-full rounded-full border border-line bg-subtle" />}>
          <NavbarSearch />
        </React.Suspense>
      </div>
      <div className="ml-auto flex shrink-0 items-center gap-1">
        {auth.status === 'signed-in' && <NotificationBell />}
        <ProfileMenu />
      </div>
    </header>
  );
}
