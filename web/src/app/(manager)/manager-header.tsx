'use client';

import Link from 'next/link';
import Image from 'next/image';
import { usePathname } from 'next/navigation';
import {
  ShieldCheck,
  ShieldAlert,
  LayoutDashboard,
  MapPin,
  User,
  FileCheck2,
  Users,
  Building2,
  MessageSquareText,
  Megaphone,
  Settings,
  Hotel,
} from 'lucide-react';
import { NotificationBell } from '@/components/notifications/notification-bell';
import {
  DashboardSwitcher,
  type DashboardSwitcherLink,
} from '@/components/layouts/dashboard-switcher';

interface ManagerHeaderProps {
  userName: string;
  userEmail: string;
  campusName: string;
  roleLabel: string;
  isSuperAdmin?: boolean;
  /** Whether this user also has an agent record (they get the Agent switcher). */
  hasAgentRecord?: boolean;
}

export function ManagerHeader({
  userName,
  userEmail,
  campusName,
  roleLabel,
  isSuperAdmin,
  hasAgentRecord = false,
}: ManagerHeaderProps) {
  const pathname = usePathname();

  const dashboardLinks: DashboardSwitcherLink[] = [
    { href: '/manager', label: 'Manager', icon: ShieldCheck, show: true },
    { href: '/dashboard', label: 'Agent', icon: LayoutDashboard, show: hasAgentRecord },
    { href: '/account', label: 'Student', icon: User, show: true },
    { href: '/admin', label: 'Admin', icon: ShieldAlert, show: !!isSuperAdmin },
  ];

  const sectionLinks: DashboardSwitcherLink[] = [
    { href: '/manager', label: 'Overview', icon: LayoutDashboard, exact: true },
    { href: '/manager/applications', label: 'Applications', icon: FileCheck2 },
    { href: '/manager/agents', label: 'Agents', icon: Users },
    { href: '/manager/listings', label: 'Listings', icon: Building2 },
    { href: '/manager/operations', label: 'Operations', icon: ShieldCheck },
    { href: '/manager/hostels', label: 'Hostels', icon: Hotel },
    { href: '/manager/requests', label: 'Hostel Requests', icon: MessageSquareText },
    { href: '/manager/announcements', label: 'Announcements', icon: Megaphone },
    { href: '/manager/zones', label: 'Zones', icon: MapPin },
    { href: '/manager/settings', label: 'Settings', icon: Settings },
  ];

  if (isSuperAdmin) {
    sectionLinks.push({
      href: '/manager/staff',
      label: 'Staff',
      icon: ShieldCheck,
    });
  }

  function isActive(href: string, exact?: boolean) {
    return exact ? pathname === href : pathname.startsWith(href);
  }

  return (
    <>
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

            {/* Right: Notifications */}
            <div className="flex items-center gap-2">
              <NotificationBell />
            </div>
          </div>
        </div>
      </header>

      {/* Dashboard shortcuts + mobile section icons */}
      <DashboardSwitcher links={dashboardLinks} sectionLinks={sectionLinks} />

      {/* Manager sub-navigation — desktop only. Mobile uses the icon bar above. */}
      <div className="border-b border-slate-100 bg-white hidden md:block">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <nav className="flex items-center gap-1 overflow-x-auto scrollbar-hide py-2 -mx-1">
            {sectionLinks.map(({ href, label, exact }) => {
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
        </div>
      </div>
    </>
  );
}