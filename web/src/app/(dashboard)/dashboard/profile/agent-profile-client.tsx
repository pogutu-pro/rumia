'use client';

import { useState } from 'react';
import { NotificationSettings } from '@/components/settings/NotificationSettings';
import { PushNotificationPrompt } from '@/components/pwa/PushNotificationPrompt';
import { AgentProfileForm } from './agent-profile-form';
import { createClient } from '@/lib/supabase/client';
import { toast } from 'sonner';
import { Loader2, LogOut } from 'lucide-react';

interface AgentProfileClientProps {
  agent: Record<string, any>;
}

export function AgentProfileClient({ agent }: AgentProfileClientProps) {
  const [loggingOut, setLoggingOut] = useState(false);

  const handleSignOut = async () => {
    setLoggingOut(true);
    const supabase = createClient();
    await supabase.auth.signOut({ scope: 'local' });
    toast.success('Signed out successfully');
    window.location.href = '/auth/login';
  };

  return (
    <>
      <AgentProfileForm agent={agent} />

      <div className="mt-10 pt-8 border-t border-slate-100 space-y-4">
        <div>
          <h2 className="text-lg font-bold text-slate-900 mb-1">Notifications</h2>
          <p className="text-sm text-slate-500">
            Get alerted when students send inquiries or book tours.
          </p>
        </div>
        <NotificationSettings />
      </div>

      <div className="mt-8 bg-white border border-slate-200/80 rounded-2xl p-5 sm:p-6 space-y-3">
        <div>
          <h3 className="text-sm font-bold text-slate-900">Account Session</h3>
          <p className="text-xs text-slate-500 mt-0.5">
            Sign out of your agent account on this device.
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

      <PushNotificationPrompt />
    </>
  );
}
