'use client';

import Link from 'next/link';
import Image from 'next/image';
import { usePathname } from 'next/navigation';
import {
  Home,
  Search,
  Users,
  LayoutDashboard,
  ShieldAlert,
  ShieldCheck,
  User,
  CalendarCheck,
  Building2,
  MessageCircle,
  BarChart3,
  Wallet,
  CreditCard,
} from 'lucide-react';
import {
  DashboardSwitcher,
  type DashboardSwitcherLink,
} from '@/components/layouts/dashboard-switcher';

interface AgentHeaderProps {
  agentName: string;
  userEmail: string;
  isAdmin: boolean;
  isManager?: boolean;
}

const mainNavLinks = [
  { href: '/', label: 'Home', icon: Home },
  { href: '/hostels', label: 'Browse', icon: Search },
  { href: '/agents', label: 'Agents', icon: Users },
];

const sectionLinks: DashboardSwitcherLink[] = [
  { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard, exact: true },
  { href: '/dashboard/tours', label: 'Tours', icon: CalendarCheck },
  { href: '/dashboard/listings', label: 'My Listings', icon: Building2 },
  { href: '/dashboard/leads', label: 'Leads', icon: MessageCircle },
  { href: '/dashboard/analytics', label: 'Analytics', icon: BarChart3 },
  { href: '/dashboard/earnings', label: 'Earnings', icon: Wallet },
  { href: '/dashboard/payment', label: 'Payment', icon: CreditCard },
  { href: '/dashboard/profile', label: 'Profile', icon: User },
];

export function AgentHeader({ agentName, userEmail, isAdmin, isManager }: AgentHeaderProps) {
  const pathname = usePathname();

  const dashboardLinks: DashboardSwitcherLink[] = [
    { href: '/dashboard', label: 'Agent', icon: LayoutDashboard, show: true },
    { href: '/admin', label: 'Admin', icon: ShieldAlert, show: isAdmin },
    { href: '/manager', label: 'Manager', icon: ShieldCheck, show: isManager },
    { href: '/account', label: 'Student', icon: User, show: true },
  ];

  return (
    <>
      <header className="bg-white border-b border-slate-200 sticky top-0 z-30">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-14 sm:h-16">
            {/* Left: Logo */}
            <div className="flex items-center gap-6">
              <Link href="/dashboard" className="shrink-0">
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

      {/* Dashboard shortcuts + mobile section icons */}
      <DashboardSwitcher links={dashboardLinks} sectionLinks={sectionLinks} />
    </>
  );
}