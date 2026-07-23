"use client";

import { Bell, BellOff, Loader2 } from "lucide-react";
import { usePushSubscription } from "@/hooks/usePushSubscription";

export function PushNotificationSetting() {
  const { isSubscribed, permission, loading, subscribe, unsubscribe } =
    usePushSubscription();

  if (loading) {
    return (
      <div className="flex items-center gap-3 p-4 rounded-xl bg-white border border-slate-100">
        <Loader2 className="h-5 w-5 text-slate-300 animate-spin" />
        <span className="text-sm text-slate-400">Loading notification settings...</span>
      </div>
    );
  }

  const blocked = permission === "denied";

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-3 p-4 rounded-xl bg-white border border-slate-100">
        <div className="shrink-0 w-10 h-10 rounded-xl bg-slate-50 flex items-center justify-center">
          {isSubscribed ? (
            <Bell className="h-5 w-5 text-emerald-600" />
          ) : (
            <BellOff className="h-5 w-5 text-slate-400" />
          )}
        </div>

        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-slate-900">
            Push notifications
          </p>
          <p className="text-xs text-slate-500 mt-0.5">
            {blocked
              ? "Notifications are blocked. Enable them in your browser settings."
              : isSubscribed
              ? "You'll receive alerts for new listings, price drops, and agent replies."
              : "Get instant alerts when new hostels match your search."}
          </p>
        </div>

        {!blocked && (
          <button
            onClick={isSubscribed ? unsubscribe : subscribe}
            className={`shrink-0 h-9 px-4 rounded-xl text-xs font-bold transition-all active:scale-[0.97] ${
              isSubscribed
                ? "bg-slate-100 text-slate-600 hover:bg-slate-200"
                : "bg-emerald-600 text-white hover:bg-emerald-500"
            }`}
          >
            {isSubscribed ? "Disable" : "Enable"}
          </button>
        )}
      </div>

      {blocked && (
        <p className="text-xs text-amber-600 px-1">
          Notifications are blocked. To re-enable, tap the lock icon in your
          browser&apos;s address bar and allow notifications.
        </p>
      )}
    </div>
  );
}
