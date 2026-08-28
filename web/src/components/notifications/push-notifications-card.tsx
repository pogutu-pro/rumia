'use client';

import Link from 'next/link';
import { Bell, BellOff, Loader2, Settings } from 'lucide-react';
import { usePushSubscription } from '@/hooks/usePushSubscription';

/**
 * Manager overview card that surfaces push-notification status and lets the
 * manager enable alerts without digging into Settings. The detailed toggles
 * live on the manager settings page.
 */
export function PushNotificationsCard() {
  const { isSubscribed, permission, loading, subscribe, unsubscribe } =
    usePushSubscription();

  if (loading) {
    return (
      <div className="bg-white border border-slate-200/80 rounded-2xl p-4 sm:p-5 shadow-xs flex items-center gap-3">
        <Loader2 className="h-5 w-5 text-slate-300 animate-spin shrink-0" />
        <span className="text-sm text-slate-500">Checking notifications…</span>
      </div>
    );
  }

  const blocked = permission === 'denied';

  return (
    <div className="bg-white border border-slate-200/80 rounded-2xl p-4 sm:p-6 shadow-xs">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div className="space-y-1">
          <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
            <span className="w-8 h-8 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center shrink-0">
              {isSubscribed ? (
                <Bell className="h-4 w-4" />
              ) : (
                <BellOff className="h-4 w-4" />
              )}
            </span>
            Notifications
          </h3>
          <p className="text-xs text-slate-500 max-w-md">
            {blocked
              ? 'Notifications are blocked in your browser settings. Re-enable them from the address bar to get alerts.'
              : isSubscribed
              ? 'Push alerts are on — you will be notified of hostel requests, new agent applications, and system events.'
              : 'Enable push alerts so you never miss a hostel request or new agent application.'}
          </p>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {!blocked && (
            <button
              onClick={isSubscribed ? unsubscribe : subscribe}
              className={`px-4 h-10 rounded-xl text-xs font-bold transition-all active:scale-[0.97] ${
                isSubscribed
                  ? 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  : 'bg-emerald-600 text-white hover:bg-emerald-500'
              }`}
            >
              {isSubscribed ? 'Disable' : 'Enable'}
            </button>
          )}
          <Link
            href="/manager/settings"
            className="inline-flex items-center gap-1.5 px-4 h-10 rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-50 text-xs font-bold transition-colors"
          >
            <Settings className="h-4 w-4" />
            Settings
          </Link>
        </div>
      </div>
    </div>
  );
}