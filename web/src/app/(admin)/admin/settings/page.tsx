'use client';

import { useState } from 'react';
import { NotificationSettings } from '@/components/settings/NotificationSettings';
import { PushNotificationPrompt } from '@/components/pwa/PushNotificationPrompt';
import { createClient } from '@/lib/supabase/client';
import { toast } from 'sonner';
import { Loader2, LogOut } from 'lucide-react';

export default function AdminSettingsPage() {
  const [loggingOut, setLoggingOut] = useState(false);

  const handleSignOut = async () => {
    setLoggingOut(true);
    const supabase = createClient();
    await supabase.auth.signOut({ scope: 'local' });
    toast.success('Signed out successfully');
    window.location.href = '/auth/login';
  };

  return (
    <div className="max-w-2xl mx-auto">
      <div className="mb-8">
        <h1 className="text-lg sm:text-2xl font-bold text-slate-900 tracking-tight">Settings</h1>
        <p className="text-xs sm:text-sm text-slate-500 mt-1">
          Manage your account preferences and notifications.
        </p>
      </div>

      <div className="space-y-4">
        <div>
          <h2 className="text-base font-bold text-slate-900 mb-1">Notifications</h2>
          <p className="text-sm text-slate-500">
            Get alerted about new agents, bookings, and system events.
          </p>
        </div>
        <NotificationSettings />
      </div>

      <PushNotificationPrompt />

      <div className="mt-8 bg-white border border-slate-200/80 rounded-2xl p-5 sm:p-6 space-y-3">
        <div>
          <h3 className="text-sm font-bold text-slate-900">Account Session</h3>
          <p className="text-xs text-slate-500 mt-0.5">
            Sign out of your admin account on this device.
          </p>
        </div>
        <button
          type="button"
          onClick={handleSignOut}
          disabled={loggingOut}
          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl border border-red-200 bg-red-50 hover:bg-red-100/80 text-red-700 text-xs font-semibold transition-colors disabled:opacity-50"
        >
          {loggingOut ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <LogOut className="h-4 w-4" />
          )}
          {loggingOut ? 'Signing out...' : 'Sign Out'}
        </button>
      </div>
    </div>
  );
}
