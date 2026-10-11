'use client';

import * as React from 'react';
import { NavbarSearch } from '@/components/layouts/navbar-search';
import { NotificationBell } from '@/components/notifications/notification-bell';
import { BrandLink } from './side-nav';
import { ProfileMenu } from './profile-menu';
import { useShell } from './shell-provider';

/**
 * The single application header: search (with its filter affordance), notifications, profile.
 * On phones, navigation is the bottom bar, so the header is only logo, search and the bell; the profile menu
 * (Account tab on a phone) appears from `lg` up.
 */
export function TopBar() {
  const { auth } = useShell();
  return (
    <header className="sticky top-0 z-40 flex h-[var(--shell-header-h)] items-center gap-2 border-b border-line bg-raised/95 px-3 backdrop-blur supports-[backdrop-filter]:bg-raised/80 sm:gap-3 sm:px-4 lg:px-8">
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
        <div className="hidden lg:block">
          <ProfileMenu />
        </div>
      </div>
    </header>
  );
}
