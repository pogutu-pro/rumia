'use client';

import { LogOut, ShieldAlert, LayoutDashboard, Home, Search, Users } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { useRouter, usePathname } from 'next/navigation';
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
  const router = useRouter();
  const pathname = usePathname();
  const supabase = createClient();
  const firstName = fullName?.split(' ')[0] || 'Student';

  const navLinks = [
    { href: '/', label: 'Home', icon: Home },
    { href: '/hostels', label: 'Browse', icon: Search },
    { href: '/agents', label: 'Agents', icon: Users },
  ];

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    router.push('/');
    router.refresh();
  };

  return (
    <div className="bg-white border-b border-slate-100">
      <div className="max-w-2xl mx-auto px-4 py-5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-slate-900 flex items-center justify-center shrink-0 overflow-hidden">
              {avatarUrl ? (
                <img
                  src={avatarUrl}
                  alt={fullName || 'Profile'}
                  className="w-10 h-10 rounded-full object-cover"
                />
              ) : (
                <span className="text-sm font-bold text-white">
                  {firstName.charAt(0).toUpperCase()}
                </span>
              )}
            </div>
            <div>
              <h1 className="text-base font-bold text-slate-900 leading-tight">
                {firstName}
              </h1>
              <p className="text-xs text-slate-400 font-medium truncate max-w-[200px]">
                {email}
              </p>
            </div>
          </div>

          <nav className="hidden md:flex items-center gap-1 mr-4">
            {navLinks.map(({ href, label, icon: Icon }) => {
              const active = href === '/' ? pathname === '/' : pathname.startsWith(href);
              return (
                <Link
                  key={href}
                  href={href}
                  className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold transition-all ${
                    active
                      ? 'text-white bg-emerald-600 shadow-sm shadow-emerald-600/20'
                      : 'text-slate-500 hover:text-slate-900 hover:bg-slate-100'
                  }`}
                >
                  <Icon className="h-3.5 w-3.5" />
                  {label}
                </Link>
              );
            })}
          </nav>

          <div className="flex items-center gap-1">
            {(isAdmin || hasAgent) && (
              <div className="flex items-center gap-1 mr-2">
                {hasAgent && (
                  <Link
                    href="/dashboard"
                    className="p-2 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-50 transition-colors"
                    title="Agent Dashboard"
                  >
                    <LayoutDashboard className="h-4 w-4" />
                  </Link>
                )}
                {isAdmin && (
                  <Link
                    href="/admin"
                    className="p-2 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-50 transition-colors"
                    title="Admin Dashboard"
                  >
                    <ShieldAlert className="h-4 w-4" />
                  </Link>
                )}
              </div>
            )}
            <button
              onClick={handleSignOut}
              className="p-2 rounded-lg text-slate-400 hover:text-red-500 hover:bg-red-50 transition-colors"
              title="Logout"
            >
              <LogOut className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
