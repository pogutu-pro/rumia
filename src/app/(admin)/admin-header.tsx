'use client';

import Link from 'next/link';
import Image from 'next/image';
import { usePathname } from 'next/navigation';
import {
  Home,
  Search,
  Users,
  ShieldAlert,
  LayoutDashboard,
  User,
} from 'lucide-react';
import {
  DashboardSwitcher,
  type DashboardSwitcherLink,
} from '@/components/layouts/dashboard-switcher';

interface AdminHeaderProps {
  userName: string;
  userEmail: string;
  isAdmin: boolean;
  hasAgent: boolean;
}

const mainNavLinks = [
  { href: '/', label: 'Home', icon: Home },
  { href: '/hostels', label: 'Browse', icon: Search },
  { href: '/agents', label: 'Agents', icon: Users },
];

export function AdminHeader({ userName, userEmail, isAdmin, hasAgent }: AdminHeaderProps) {
  const pathname = usePathname();

  const displayName = userName || 'Admin';

  const dashboardLinks: DashboardSwitcherLink[] = [
    { href: '/admin', label: 'Admin', icon: ShieldAlert, show: true },
    { href: '/dashboard', label: 'Agent', icon: LayoutDashboard, show: hasAgent },
    { href: '/account', label: 'Student', icon: User, show: true },
  ];

  return (
    <>
      <header className="bg-white border-b border-slate-200 sticky top-0 z-30">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-14 sm:h-16">
            {/* Left: Logo */}
            <div className="flex items-center gap-6">
              <Link href="/admin" className="shrink-0">
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

              <nav className="hidden md:flex items-center gap-1">
                {mainNavLinks.map(({ href, label }) => {
                  const active = href === '/' ? pathname === '/' : pathname.startsWith(href);
                  return (
                    <Link
                      key={href}
                      href={href}
                      className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                        active
                          ? 'text-slate-900 bg-slate-100 font-semibold'
                          : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
                      }`}
                    >
                      {label}
                    </Link>
                  );
                })}
              </nav>
            </div>
          </div>
        </div>
      </header>

      {/* Dashboard shortcuts — moved out of the header */}
      <DashboardSwitcher links={dashboardLinks} />
    </>
  );
}