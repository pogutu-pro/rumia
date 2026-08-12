'use client';

import Link from 'next/link';
import Image from 'next/image';
import { usePathname, useRouter } from 'next/navigation';
import { useState } from 'react';
import {
  ShieldCheck,
  FileCheck2,
  Users,
  Building2,
  LayoutDashboard,
  Settings,
  MapPin,
  User,
  Home,
  MessageSquareText,
  Megaphone,
} from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { NotificationBell } from '@/components/notifications/notification-bell';

interface ManagerHeaderProps {
  userName: string;
  userEmail: string;
  campusName: string;
  roleLabel: string;
  isSuperAdmin?: boolean;
}

export function ManagerHeader({
  userName,
  userEmail,
  campusName,
  roleLabel,
  isSuperAdmin,
}: ManagerHeaderProps) {
  const pathname = usePathname();
  const router = useRouter();
  const supabase = createClient();

  const handleSignOut = async () => {
    await supabase.auth.signOut({ scope: 'local' });
    router.push('/auth/login');
    router.refresh();
  };

  const displayName = userName || 'Manager';

  const dashboardLinks = [
    { href: '/manager', label: 'Manager', icon: ShieldCheck },
    { href: '/dashboard', label: 'Agent', icon: LayoutDashboard },
    { href: '/account', label: 'Student', icon: User },
    { href: '/', label: 'Site', icon: Home },
  ];

  const managerNavLinks = [
    { href: '/manager', label: 'Overview', exact: true },
    { href: '/manager/applications', label: 'Applications', exact: false },
    { href: '/manager/agents', label: 'Agents', exact: false },
    { href: '/manager/listings', label: 'Listings', exact: false },
    { href: '/manager/requests', label: 'Hostel Requests', exact: false },
    { href: '/manager/announcements', label: 'Announcements', exact: false },
    { href: '/manager/zones', label: 'Zones', exact: false },
    { href: '/manager/settings', label: 'Settings', exact: false },
  ];

  if (isSuperAdmin) {
    managerNavLinks.push({ href: '/manager/staff', label: 'Staff', exact: false });
  }

  function isActive(href: string, exact?: boolean) {
    return exact ? pathname === href : pathname.startsWith(href);
  }

  return (
    <header className="bg-white border-b border-slate-200 sticky top-0 z-30">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-14 sm:h-16">
          {/* Left: Logo + Campus chip */}
          <div className="flex items-center gap-3 min-w-0">
            <Link href="/manager" className="shrink-0">
              <Image
                src="/images/logo/logo.svg"
                alt="Rumia"
                width={90}
                height={28}
                priority
                sizes="90px"
                style={{ height: 'auto' }}
              />
            </Link>
            <span className="hidden sm:inline-flex items-center gap-1.5 text-xs font-medium text-slate-600 bg-slate-100 px-2.5 py-1 rounded-full truncate max-w-[200px]">
              <MapPin className="h-3.5 w-3.5 text-slate-400 shrink-0" />
              <span className="truncate">{campusName}</span>
            </span>
          </div>

          {/* Right: Notifications + dashboard icons */}
          <div className="flex items-center gap-1 sm:gap-2">
            <NotificationBell />

            {/* Desktop dashboard switcher */}
            <div className="hidden md:flex items-center gap-1">
              {dashboardLinks.map(({ href, label, icon: Icon }) => {
                const active = pathname === href || (href !== '/' && pathname.startsWith(href));
                return (
                  <Link
                    key={href}
                    href={href}
                    title={label}
                    className={`flex items-center gap-1.5 px-2 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                      active
                        ? 'bg-emerald-50 text-emerald-700'
                        : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
                    }`}
                  >
                    <Icon className="h-4 w-4 shrink-0" />
                    <span className="hidden xl:inline">{label}</span>
                  </Link>
                );
              })}
            </div>

            {/* Mobile: compact icon buttons for dashboard switching */}
            <div className="flex md:hidden items-center gap-0.5">
              {dashboardLinks.map(({ href, label, icon: Icon }) => {
                const active = pathname === href || (href !== '/' && pathname.startsWith(href));
                return (
                  <Link
                    key={href}
                    href={href}
                    title={label}
                    className={`flex items-center justify-center w-8 h-8 rounded-lg text-xs transition-colors ${
                      active
                        ? 'bg-emerald-50 text-emerald-700'
                        : 'text-slate-500 hover:text-slate-900 hover:bg-slate-50'
                    }`}
                  >
                    <Icon className="h-4 w-4" />
                  </Link>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      {/* Manager sub-navigation - horizontal scroll on desktop, icon row on mobile */}
      <div className="border-t border-slate-100">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <nav className="hidden md:flex items-center gap-1 overflow-x-auto scrollbar-hide py-2 -mx-1">
            {managerNavLinks.map(({ href, label, exact }) => {
              const active = isActive(href, exact);
              return (
                <Link
                  key={href}
                  href={href}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-colors shrink-0 ${
                    active
                      ? 'text-emerald-700 bg-emerald-50 font-semibold'
                      : 'text-slate-500 hover:text-slate-700 hover:bg-slate-50'
                  }`}
                >
                  {label}
                </Link>
              );
            })}
          </nav>
          {/* Mobile manager nav icons */}
          <nav className="flex md:hidden items-center gap-0.5 overflow-x-auto py-2 -mx-1">
            {managerNavLinks.map(({ href, label, exact }) => {
              const active = isActive(href, exact);
              return (
                <Link
                  key={href}
                  href={href}
                  title={label}
                  className={`flex items-center justify-center w-9 h-9 rounded-lg text-xs transition-colors shrink-0 ${
                    active
                      ? 'bg-emerald-50 text-emerald-700'
                      : 'text-slate-500 hover:text-slate-900 hover:bg-slate-50'
                  }`}
                >
                  {label}
                </Link>
              );
            })}
          </nav>
        </div>
      </div>
    </header>
  );
}
