'use client';

import Link from 'next/link';
import { ShieldAlert, LayoutDashboard, ArrowRight } from 'lucide-react';

interface AccountDashboardBarProps {
  isAdmin: boolean;
  hasAgent: boolean;
}

export function AccountDashboardBar({ isAdmin, hasAgent }: AccountDashboardBarProps) {
  const links = [
    ...(isAdmin ? [{ label: 'Admin Dashboard', href: '/admin', icon: ShieldAlert, desc: 'Analytics & management' }] : []),
    ...(hasAgent ? [{ label: 'Agent Dashboard', href: '/dashboard', icon: LayoutDashboard, desc: 'Listings & leads' }] : []),
  ];

  if (links.length === 0) return null;

  return (
    <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 mb-8">
      <p className="text-xs font-bold tracking-widest text-amber-700 uppercase mb-3">
        You have access to other dashboards
      </p>
      <div className="flex flex-wrap gap-3">
        {links.map(({ label, href, icon: Icon, desc }) => (
          <Link
            key={href}
            href={href}
            className="flex items-center gap-3 px-4 py-2.5 bg-white border border-amber-200 rounded-xl text-sm font-medium text-amber-800 hover:bg-amber-100 hover:border-amber-300 transition-all"
          >
            <Icon className="h-4 w-4 shrink-0" />
            <div>
              <p>{label}</p>
              <p className="text-xs text-amber-600 font-normal">{desc}</p>
            </div>
            <ArrowRight className="h-3.5 w-3.5 shrink-0 ml-2" />
          </Link>
        ))}
      </div>
    </div>
  );
}
