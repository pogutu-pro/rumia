'use client';

import Link from 'next/link';
import Image from 'next/image';
import { usePathname, useRouter } from 'next/navigation';
import { useState } from 'react';
import {
  LayoutDashboard,
  BarChart3,
  Users,
  Building2,
  MousePointerClick,
  DollarSign,
  LogOut,
  Menu,
  X,
} from 'lucide-react';
import { createClient } from '@/lib/supabase/client';

export interface AdminSidebarProps {
  userName: string;
  userEmail: string;
}

const navLinks = [
  { label: 'Overview', href: '/admin', icon: LayoutDashboard, exact: true },
  { label: 'Analytics', href: '/admin/analytics', icon: BarChart3, exact: false },
  { label: 'Agents', href: '/admin/agents', icon: Users, exact: false },
  { label: 'Listings', href: '/admin/listings', icon: Building2, exact: false },
  { label: 'Leads', href: '/admin/leads', icon: MousePointerClick, exact: false },
  { label: 'Commissions', href: '/admin/commissions', icon: DollarSign, exact: false },
];

function SidebarContent({
  userName,
  userEmail,
  pathname,
  onNavigate,
  onSignOut,
}: AdminSidebarProps & {
  pathname: string;
  onNavigate: () => void;
  onSignOut: () => void;
}) {
  return (
    <div className="flex flex-col h-full">
      <div className="px-6 py-5 border-b border-gray-100">
        <Link href="/admin" className="inline-flex items-center" onClick={onNavigate}>
          <Image src="/images/logo/logo.svg" alt="Rumia" width={100} height={32} priority style={{ height: 'auto' }} />
        </Link>
      </div>

      <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
        {navLinks.map(({ label, href, icon: Icon, exact }) => {
          const isActive = exact ? pathname === href : pathname.startsWith(href);
          return (
            <Link
              key={href}
              href={href}
              onClick={onNavigate}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm transition-all ${
                isActive
                  ? 'bg-emerald-50 text-emerald-700 font-semibold'
                  : 'text-gray-500 hover:bg-gray-50 hover:text-gray-700'
              }`}
            >
              <Icon className="h-4 w-4 shrink-0" />
              {label}
            </Link>
          );
        })}
      </nav>

      <div className="px-4 py-4 border-t border-gray-100">
        <div className="mb-3">
          <p className="text-sm font-semibold text-gray-900 truncate">{userName}</p>
          <p className="text-xs text-gray-400 truncate">{userEmail}</p>
        </div>
        <button
          onClick={onSignOut}
          className="flex items-center gap-2 text-sm text-gray-500 hover:text-red-600 transition-colors w-full rounded-xl px-3 py-2 hover:bg-red-50"
        >
          <LogOut className="h-4 w-4 shrink-0" />
          Logout
        </button>
      </div>
    </div>
  );
}

export function AdminSidebar({ userName, userEmail }: AdminSidebarProps) {
  const pathname = usePathname();
  const router = useRouter();
  const supabase = createClient();
  const [open, setOpen] = useState(false);

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    router.push('/auth/login');
    router.refresh();
  };

  return (
    <>
      {/* Desktop sidebar */}
      <aside className="hidden lg:flex w-60 bg-white border-r border-gray-200 flex-col fixed left-0 top-0 h-full z-30">
        <SidebarContent
          userName={userName}
          userEmail={userEmail}
          pathname={pathname}
          onNavigate={() => {}}
          onSignOut={handleSignOut}
        />
      </aside>

      {/* Mobile top bar */}
      <div className="lg:hidden fixed top-0 left-0 right-0 z-40 bg-white/80 backdrop-blur-lg border-b border-gray-200 flex items-center justify-between px-4 h-14">
        <Link href="/admin">
          <Image src="/images/logo/logo.svg" alt="Rumia" width={80} height={26} priority style={{ height: 'auto' }} />
        </Link>
        <button
          onClick={() => setOpen(true)}
          className="p-2 rounded-xl text-gray-500 hover:text-gray-700 hover:bg-gray-100 transition-colors active:scale-95"
          aria-label="Open menu"
        >
          <Menu className="h-5 w-5" />
        </button>
      </div>

      {/* Backdrop */}
      {open && (
        <div
          className="lg:hidden fixed inset-0 z-50 bg-black/40 backdrop-blur-sm"
          onClick={() => setOpen(false)}
        />
      )}

      {/* Mobile drawer */}
      <aside
        className={`lg:hidden fixed top-0 left-0 h-full w-72 bg-white z-50 shadow-2xl transition-transform duration-300 ease-out ${
          open ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="absolute top-3 right-3">
          <button
            onClick={() => setOpen(false)}
            className="p-2 rounded-xl text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-colors active:scale-95"
            aria-label="Close menu"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
        <SidebarContent
          userName={userName}
          userEmail={userEmail}
          pathname={pathname}
          onNavigate={() => setOpen(false)}
          onSignOut={handleSignOut}
        />
      </aside>
    </>
  );
}
