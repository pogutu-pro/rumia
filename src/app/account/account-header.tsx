'use client';

import { ShieldAlert, LayoutDashboard, Home, Search, Users, User } from 'lucide-react';
import { usePathname } from 'next/navigation';
import Link from 'next/link';

interface AccountHeaderProps {
  fullName: string | null;
  email: string;
  avatarUrl: string | null;
  isAdmin: boolean;
  hasAgent: boolean;
}

export function AccountHeader({
  fullName,
  email,
  avatarUrl,
  isAdmin,
  hasAgent,
}: AccountHeaderProps) {
  const pathname = usePathname();
  const displayName = fullName || 'Student';

  const navLinks = [
    { href: '/', label: 'Home', icon: Home },
    { href: '/hostels', label: 'Browse', icon: Search },
    { href: '/agents', label: 'Agents', icon: Users },
  ];

  const dashboardLinks = [
    { href: '/account', label: 'Student', icon: User, show: true },
    { href: '/dashboard', label: 'Agent', icon: LayoutDashboard, show: hasAgent },
    { href: '/admin', label: 'Admin', icon: ShieldAlert, show: isAdmin },
    { href: '/', label: 'Site', icon: Home, show: true },
  ];

  return (
    <header className="bg-white border-b border-slate-200">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-4 sm:py-5">
        <div className="flex items-center justify-between">
          {/* Left: User identity */}
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-slate-100 border border-slate-200 flex items-center justify-center shrink-0 overflow-hidden">
              {avatarUrl ? (
                <img
                  src={avatarUrl}
                  alt={displayName}
                  className="w-full h-full object-cover"
                />
              ) : (
                <span className="text-sm font-semibold text-slate-700">
                  {displayName.charAt(0).toUpperCase()}
                </span>
              )}
            </div>
            <div>
              <h1 className="text-base font-semibold text-slate-900 leading-tight">
                {displayName}
              </h1>
              <p className="text-xs text-slate-500 font-normal truncate max-w-[200px] sm:max-w-xs">
                {email}
              </p>
            </div>
          </div>

          {/* Right: Nav links + Dashboard switcher icons */}
          <div className="flex items-center gap-2">
            <nav className="hidden md:flex items-center gap-1 mr-2">
              {navLinks.map(({ href, label }) => {
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

            {/* Desktop dashboard switcher */}
            <div className="hidden md:flex items-center gap-1">
              {dashboardLinks.filter(l => l.show).map(({ href, label, icon: Icon }) => {
                const active = pathname === href || pathname.startsWith(href);
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
              {dashboardLinks.filter(l => l.show).map(({ href, label, icon: Icon }) => {
                const active = pathname === href || pathname.startsWith(href);
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
    </header>
  );
}
