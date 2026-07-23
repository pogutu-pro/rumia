"use client";

import { Bell, X } from "lucide-react";
import { useNotificationPrompt } from "@/hooks/useNotificationPrompt";
import { usePushSubscription } from "@/hooks/usePushSubscription";

export function PushNotificationPrompt() {
  const { shouldShow, dismiss } = useNotificationPrompt();
  const { subscribe, permission } = usePushSubscription();

  if (!shouldShow || permission !== "default") return null;

  const handleEnable = async () => {
    await subscribe();
    dismiss();
  };

  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 p-4 pb-[calc(1rem+env(safe-area-inset-bottom))]">
      <div className="mx-auto max-w-lg rounded-2xl bg-white shadow-2xl shadow-black/10 border border-slate-100 overflow-hidden">
        <div className="relative p-4">
          <button
            onClick={dismiss}
            aria-label="Dismiss"
            className="absolute top-3 right-3 p-1.5 rounded-full text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
          >
            <X className="h-4 w-4" />
          </button>

          <div className="flex items-start gap-3 pr-8">
            <div className="shrink-0 w-10 h-10 rounded-xl bg-emerald-50 flex items-center justify-center">
              <Bell className="h-5 w-5 text-emerald-600" />
            </div>

            <div className="flex-1 min-w-0">
              <h3 className="text-sm font-bold text-slate-900">
                Stay in the loop
              </h3>
              <p className="text-xs text-slate-500 mt-0.5 leading-relaxed">
                Get instant alerts for new hostels, price drops, and tour updates
                near DeKUT.
              </p>
            </div>
          </div>

          <div className="mt-3 flex gap-2">
            <button
              onClick={handleEnable}
              className="flex-1 inline-flex items-center justify-center h-9 rounded-xl bg-emerald-600 text-xs font-bold text-white hover:bg-emerald-500 active:scale-[0.98] transition-all"
            >
              Enable notifications
            </button>
            <button
              onClick={dismiss}
              className="h-9 px-4 rounded-xl text-xs font-semibold text-slate-500 hover:bg-slate-50 transition-colors"
            >
              Not now
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
