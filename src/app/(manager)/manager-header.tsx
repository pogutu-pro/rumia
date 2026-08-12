'use client';

import Link from 'next/link';
import Image from 'next/image';
import { usePathname, useRouter } from 'next/navigation';
import { useState, useRef, useEffect } from 'react';
import {
  ShieldCheck,
  FileCheck2,
  Users,
  Building2,
  LayoutDashboard,
  Settings,
  MapPin,
  LogOut,
  ChevronDown,
  User,
  Home,
  MessageSquareText,
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
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    }
    if (menuOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [menuOpen]);

  const handleSignOut = async () => {
    setMenuOpen(false);
    await supabase.auth.signOut({ scope: 'local' });
    router.push('/auth/login');
    router.refresh();
  };

  const displayName = userName || 'Manager';
  const initials = displayName.charAt(0).toUpperCase();

  const navItems = [
    { href: '/manager', label: 'Overview', icon: ShieldCheck },
    { href: '/manager/applications', label: 'Applications', icon: FileCheck2 },
    { href: '/manager/agents', label: 'Agents', icon: Users },
    { href: '/manager/listings', label: 'Listings', icon: Building2 },
    { href: '/manager/requests', label: 'Hostel Requests', icon: MessageSquareText },
    { href: '/manager/zones', label: 'Zones', icon: MapPin },
    { href: '/manager/settings', label: 'Settings', icon: Settings },
  ];

  if (isSuperAdmin) {
    navItems.push({ href: '/manager/staff', label: 'Staff', icon: Users });
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

          {/* Desktop Nav */}
          <nav className="hidden lg:flex items-center gap-1">
            {navItems.map(({ href, label, icon: Icon }) => {
              const isActive = href === '/manager' ? pathname === '/manager' : pathname.startsWith(href);
              return (
                <Link
                  key={href}
                  href={href}
                  className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                    isActive
                      ? 'bg-emerald-50 text-emerald-700 font-semibold'
                      : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
                  }`}
                >
                  <Icon className="h-4 w-4 shrink-0" />
                  {label}
                </Link>
              );
            })}
          </nav>

          {/* Right: Notifications + user menu */}
          <div className="flex items-center gap-1.5 sm:gap-2">
            <NotificationBell />
            <div className="relative" ref={menuRef}>
              <button
                onClick={() => setMenuOpen(!menuOpen)}
                className="flex items-center gap-2 p-1.5 rounded-xl hover:bg-slate-50 transition-colors"
                aria-label="User menu"
                aria-expanded={menuOpen}
              >
              <div className="w-8 h-8 rounded-full bg-slate-100 border border-slate-200 flex items-center justify-center shrink-0">
                <span className="text-xs font-semibold text-slate-700">{initials}</span>
              </div>
              <ChevronDown
                className={`h-3.5 w-3.5 text-slate-400 transition-transform ${menuOpen ? 'rotate-180' : ''}`}
              />
            </button>

            {menuOpen && (
              <div className="absolute right-0 top-full mt-2 w-64 bg-white rounded-2xl border border-slate-200/80 shadow-lg py-2 z-50">
                {/* User info */}
                <div className="px-4 py-3 border-b border-slate-100">
                  <p className="text-sm font-semibold text-slate-900 truncate">{displayName}</p>
                  <p className="text-xs text-slate-500 truncate mt-0.5">{userEmail}</p>
                  <p className="text-[10px] font-bold tracking-widest text-emerald-600 uppercase mt-1">
                    {isSuperAdmin ? 'Administrator' : roleLabel}
                  </p>
                </div>

                {/* Dashboard links */}
                <div className="py-1">
                  <Link
                    href="/manager"
                    onClick={() => setMenuOpen(false)}
                    className="flex items-center gap-3 px-4 py-2.5 text-sm text-slate-700 hover:bg-slate-50 transition-colors"
                  >
                    <ShieldCheck className="h-4 w-4 text-slate-400" />
                    Manager Dashboard
                  </Link>
                  <Link
                    href="/dashboard"
                    onClick={() => setMenuOpen(false)}
                    className="flex items-center gap-3 px-4 py-2.5 text-sm text-slate-700 hover:bg-slate-50 transition-colors"
                  >
                    <LayoutDashboard className="h-4 w-4 text-slate-400" />
                    Agent Dashboard
                  </Link>
                  <Link
                    href="/account"
                    onClick={() => setMenuOpen(false)}
                    className="flex items-center gap-3 px-4 py-2.5 text-sm text-slate-700 hover:bg-slate-50 transition-colors"
                  >
                    <User className="h-4 w-4 text-slate-400" />
                    Student Account
                  </Link>
                  <Link
                    href="/"
                    onClick={() => setMenuOpen(false)}
                    className="flex items-center gap-3 px-4 py-2.5 text-sm text-slate-700 hover:bg-slate-50 transition-colors"
                  >
                    <Home className="h-4 w-4 text-slate-400" />
                    Back to Site
                  </Link>
                </div>

                {/* Mobile-only nav */}
                <div className="py-1 border-t border-slate-100 lg:hidden">
                  {navItems.map(({ href, label, icon: Icon }) => (
                    <Link
                      key={href}
                      href={href}
                      onClick={() => setMenuOpen(false)}
                      className="flex items-center gap-3 px-4 py-2.5 text-sm text-slate-700 hover:bg-slate-50 transition-colors"
                    >
                      <Icon className="h-4 w-4 text-slate-400" />
                      {label}
                    </Link>
                  ))}
                </div>

                {/* Logout */}
                <div className="py-1 border-t border-slate-100">
                  <button
                    onClick={handleSignOut}
                    className="flex items-center gap-3 px-4 py-2.5 text-sm text-red-600 hover:bg-red-50 transition-colors w-full"
                  >
                    <LogOut className="h-4 w-4" />
                    Sign Out
                  </button>
                </div>
              </div>
            )}
            </div>
          </div>
        </div>
      </div>
    </header>
  );
}