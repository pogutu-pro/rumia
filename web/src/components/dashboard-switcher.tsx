'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { ShieldAlert, LayoutDashboard, User } from 'lucide-react';

interface DashboardSwitcherProps {
  isAdmin: boolean;
  hasAgent: boolean;
}

export function DashboardSwitcher({ isAdmin, hasAgent }: DashboardSwitcherProps) {
  const pathname = usePathname();

  const dashboards = [
    ...(isAdmin ? [{ label: 'Admin Dashboard', href: '/admin', icon: ShieldAlert }] : []),
    ...(hasAgent ? [{ label: 'Agent Dashboard', href: '/dashboard', icon: LayoutDashboard }] : []),
    { label: 'Student Account', href: '/account', icon: User },
  ];

  if (dashboards.length <= 1) return null;

  return (
    <div className="border-t border-gray-100 pt-3 mt-3">
      <p className="px-3 text-[10px] font-bold tracking-widest text-gray-400 uppercase mb-2">
        Switch View
      </p>
      <div className="space-y-0.5">
        {dashboards.map(({ label, href, icon: Icon }) => {
          const isActive = pathname.startsWith(href);
          return (
            <Link
              key={href}
              href={href}
              className={`flex items-center gap-3 px-3 py-2 rounded-md text-sm transition-colors ${
                isActive
                  ? 'bg-gray-100 text-gray-900 font-semibold'
                  : 'text-gray-500 hover:bg-gray-50 hover:text-gray-700'
              }`}
            >
              <Icon className="h-4 w-4 shrink-0" />
              <span className="flex-1 truncate">{label}</span>
              {isActive && (
                <span className="h-2 w-2 rounded-full bg-emerald-500 shrink-0" />
              )}
            </Link>
          );
        })}
      </div>
    </div>
  );
}
