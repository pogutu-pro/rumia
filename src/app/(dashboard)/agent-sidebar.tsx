'use client';

import Link from 'next/link';
import Image from 'next/image';
import { usePathname, useRouter } from 'next/navigation';
import { useState } from 'react';
import {
  LayoutDashboard,
  Building2,
  Plus,
  LogOut,
  Menu,
  X,
  User,
} from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { DashboardSwitcher } from '@/components/dashboard-switcher';

export interface AgentSidebarProps {
  agentName: string;
  userEmail: string;
  isAdmin: boolean;
  hasAgent?: boolean;
}

const navLinks = [
  { label: 'Dashboard', href: '/dashboard', icon: LayoutDashboard, exact: true },
  { label: 'My Listings', href: '/dashboard/new', icon: Building2, exact: false },
  { label: 'My Profile', href: '/dashboard/profile', icon: User, exact: false },
];

function SidebarContent({
  agentName,
  userEmail,
  isAdmin,
  hasAgent = true,
  pathname,
  onNavigate,
  onSignOut,
}: AgentSidebarProps & {
  pathname: string;
  onNavigate: () => void;
  onSignOut: () => void;
}) {
  return (
    <div className="flex flex-col h-full">
      {/* Logo */}
      <div className="px-6 py-5 border-b border-gray-100">
        <Link href="/dashboard" className="inline-flex items-center" onClick={onNavigate}>
          <Image src="/images/logo/logo.svg" alt="Rumia" width={100} height={32} priority sizes="100px" style={{ height: 'auto' }} />
        </Link>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
        {navLinks.map(({ label, href, icon: Icon, exact }) => {
          const isActive = exact ? pathname === href : pathname.startsWith(href);
          return (
            <Link
              key={href}
              href={href}
              onClick={onNavigate}
              className={[
                'flex items-center gap-3 px-3 py-2 rounded-md text-sm transition-colors',
                isActive
                  ? 'bg-gray-100 text-gray-900 font-semibold'
                  : 'text-gray-500 hover:bg-gray-50 hover:text-gray-700',
              ].join(' ')}
            >
              <Icon className="h-4 w-4 shrink-0" />
              {label}
            </Link>
          );
        })}

        <Link
          href="/dashboard/new"
          onClick={onNavigate}
          className="flex items-center gap-3 px-3 py-2 rounded-md text-sm transition-colors text-emerald-600 hover:bg-emerald-50 hover:text-emerald-700 font-medium mt-2"
        >
          <Plus className="h-4 w-4 shrink-0" />
          New Listing
        </Link>

        <DashboardSwitcher isAdmin={isAdmin} hasAgent={hasAgent} />
      </nav>

      {/* User / Logout */}
      <div className="px-4 py-4 border-t border-gray-100">
        <div className="mb-3">
          <p className="text-sm font-semibold text-gray-900 truncate">{agentName}</p>
          <p className="text-xs text-gray-400 truncate">{userEmail}</p>
          <p className="text-[10px] font-bold tracking-widest text-emerald-600 uppercase mt-0.5">
            {isAdmin ? 'Administrator' : 'Agent'}
          </p>
        </div>
        <button
          onClick={onSignOut}
          className="flex items-center gap-2 text-sm text-gray-500 hover:text-gray-700 transition-colors w-full"
        >
          <LogOut className="h-4 w-4 shrink-0" />
          Logout
        </button>
      </div>
    </div>
  );
}

export function AgentSidebar({ agentName, userEmail, isAdmin, hasAgent = true }: AgentSidebarProps) {
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
      <aside className="hidden lg:flex w-60 bg-white border-r border-gray-200 flex-col h-full fixed left-0 top-0">
        <SidebarContent
          agentName={agentName}
          userEmail={userEmail}
          isAdmin={isAdmin}
          hasAgent={hasAgent}
          pathname={pathname}
          onNavigate={() => {}}
          onSignOut={handleSignOut}
        />
      </aside>

      {/* Mobile top bar */}
      <div className="lg:hidden fixed top-0 left-0 right-0 z-40 bg-white border-b border-gray-200 flex items-center justify-between px-4 h-14">
        <Link href="/dashboard">
          <Image src="/images/logo/logo.svg" alt="Rumia" width={80} height={26} priority sizes="80px" style={{ height: 'auto' }} />
        </Link>
        <button
          onClick={() => setOpen(true)}
          className="p-2 rounded-md text-gray-500 hover:text-gray-700 hover:bg-gray-100 transition-colors"
          aria-label="Open menu"
        >
          <Menu className="h-5 w-5" />
        </button>
      </div>

      {/* Mobile drawer backdrop */}
      {open && (
        <div
          className="lg:hidden fixed inset-0 z-50 bg-black/40"
          onClick={() => setOpen(false)}
        />
      )}

      {/* Mobile drawer */}
      <aside
        className={[
          'lg:hidden fixed top-0 left-0 h-full w-64 bg-white z-50 shadow-xl transition-transform duration-300',
          open ? 'translate-x-0' : '-translate-x-full',
        ].join(' ')}
      >
        <div className="absolute top-3 right-3">
          <button
            onClick={() => setOpen(false)}
            className="p-1.5 rounded-md text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-colors"
            aria-label="Close menu"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
        <SidebarContent
          agentName={agentName}
          userEmail={userEmail}
          isAdmin={isAdmin}
          hasAgent={hasAgent}
          pathname={pathname}
          onNavigate={() => setOpen(false)}
          onSignOut={handleSignOut}
        />
      </aside>
    </>
  );
}
