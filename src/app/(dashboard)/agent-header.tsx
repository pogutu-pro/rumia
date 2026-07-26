'use client';

import Link from 'next/link';
import Image from 'next/image';
import { usePathname, useRouter } from 'next/navigation';
import { useState, useRef, useEffect } from 'react';
import {
  Home,
  Search,
  Users,
  LayoutDashboard,
  ShieldAlert,
  User,
  LogOut,
  ChevronDown,
} from 'lucide-react';
import { createClient } from '@/lib/supabase/client';

interface AgentHeaderProps {
  agentName: string;
  userEmail: string;
  isAdmin: boolean;
}

const mainNavLinks = [
  { href: '/', label: 'Home', icon: Home },
  { href: '/hostels', label: 'Browse', icon: Search },
  { href: '/agents', label: 'Agents', icon: Users },
];

export function AgentHeader({ agentName, userEmail, isAdmin }: AgentHeaderProps) {
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
    await supabase.auth.signOut();
    router.push('/auth/login');
    router.refresh();
  };

  const displayName = agentName || 'Agent';
  const initials = displayName.charAt(0).toUpperCase();

  return (
    <header className="bg-white border-b border-slate-200 sticky top-0 z-30">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-14 sm:h-16">
          {/* Left: Logo + Desktop Nav */}
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

              <Link
                href="/dashboard"
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                  pathname === '/dashboard'
                    ? 'text-emerald-700 bg-emerald-50 font-semibold'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
                }`}
              >
                Dashboard
              </Link>

              {isAdmin && (
                <Link
                  href="/admin"
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                    pathname.startsWith('/admin')
                      ? 'text-slate-900 bg-slate-100 font-semibold'
                      : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
                  }`}
                >
                  Admin
                </Link>
              )}

              <Link
                href="/account"
                className="px-3 py-1.5 rounded-lg text-xs font-medium text-slate-600 hover:text-slate-900 hover:bg-slate-50 transition-colors"
              >
                Student Account
              </Link>
            </nav>
          </div>

          {/* Right: User menu */}
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
                className={`h-3.5 w-3.5 text-slate-400 transition-transform hidden sm:block ${
                  menuOpen ? 'rotate-180' : ''
                }`}
              />
            </button>

            {menuOpen && (
              <div className="absolute right-0 top-full mt-2 w-64 bg-white rounded-2xl border border-slate-200/80 shadow-lg py-2 z-50">
                {/* User info */}
                <div className="px-4 py-3 border-b border-slate-100">
                  <p className="text-sm font-semibold text-slate-900 truncate">{displayName}</p>
                  <p className="text-xs text-slate-500 truncate mt-0.5">{userEmail}</p>
                  <p className="text-[10px] font-bold tracking-widest text-emerald-600 uppercase mt-1">
                    {isAdmin ? 'Administrator' : 'Agent'}
                  </p>
                </div>

                {/* Dashboard links */}
                <div className="py-1">
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
                  {isAdmin && (
                    <Link
                      href="/admin"
                      onClick={() => setMenuOpen(false)}
                      className="flex items-center gap-3 px-4 py-2.5 text-sm text-slate-700 hover:bg-slate-50 transition-colors"
                    >
                      <ShieldAlert className="h-4 w-4 text-slate-400" />
                      Admin Dashboard
                    </Link>
                  )}
                </div>

                {/* Mobile-only main nav links */}
                <div className="py-1 border-t border-slate-100 md:hidden">
                  {mainNavLinks.map(({ href, label, icon: Icon }) => (
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
    </header>
  );
}
