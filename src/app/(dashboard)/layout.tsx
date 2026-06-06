import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import { Building2, Plus, LogOut, ShieldAlert, LayoutDashboard } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { LogoutButton } from './logout-button';

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    redirect('/auth/login');
  }

  const email = user.email || '';
  const isAdmin = email.toLowerCase().includes('admin') || email.toLowerCase() === 'paul@rumia.co.ke';

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col font-sans text-slate-900">
      {/* Portal Navbar */}
      <header className="bg-slate-900 text-white sticky top-0 z-50 border-b border-slate-800 shadow-md">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16 items-center">
            {/* Left Brand */}
            <div className="flex items-center gap-8">
              <Link href="/" className="flex items-center gap-2 font-black text-xl tracking-tight text-emerald-400">
                <Building2 className="h-6 w-6" />
                RUMIA PORTAL
              </Link>
              
              <nav className="hidden md:flex items-center gap-1 font-semibold text-sm">
                <Link href="/dashboard" className="px-3.5 py-2 text-slate-300 hover:text-white rounded-lg transition-colors flex items-center gap-1.5">
                  <LayoutDashboard className="h-4 w-4" />
                  Agent Dashboard
                </Link>
                <Link href="/dashboard/new" className="px-3.5 py-2 text-slate-300 hover:text-white rounded-lg transition-colors flex items-center gap-1.5">
                  <Plus className="h-4 w-4" />
                  New Listing
                </Link>
                {isAdmin && (
                  <Link href="/admin" className="px-3.5 py-2 text-rose-300 hover:text-rose-200 rounded-lg transition-colors flex items-center gap-1.5">
                    <ShieldAlert className="h-4 w-4" />
                    Admin Panel
                  </Link>
                )}
              </nav>
            </div>

            {/* Right side user menu */}
            <div className="flex items-center gap-4">
              <div className="hidden sm:block text-right">
                <div className="text-xs font-bold text-slate-400 truncate max-w-[180px]">{email}</div>
                <div className="text-[10px] font-black tracking-widest text-emerald-400 uppercase">
                  {isAdmin ? 'Administrator' : 'Agent'}
                </div>
              </div>

              <div className="h-6 w-px bg-slate-850" />

              <LogoutButton />
            </div>
          </div>
        </div>
      </header>

      {/* Main Panel Content */}
      <main className="flex-1 max-w-7xl mx-auto w-full px-4 sm:px-6 lg:px-8 py-8">
        {children}
      </main>
    </div>
  );
}
