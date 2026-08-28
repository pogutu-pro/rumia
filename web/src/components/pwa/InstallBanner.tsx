"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { Download, X, Share } from "lucide-react";
import { usePWAInstall } from "@/hooks/usePWAInstall";

export function InstallBanner() {
  const [mounted, setMounted] = useState(false);
  const { shouldShow, isIOS, handleInstall, handleDismiss } = usePWAInstall();

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted || !shouldShow) return null;

  return createPortal(
    <div
      className="fixed left-0 right-0 z-50 p-4 pointer-events-none md:bottom-0"
      style={{ bottom: "calc(4.25rem + env(safe-area-inset-bottom, 0px))" }}
    >
      <div className="mx-auto max-w-lg rounded-2xl bg-white shadow-2xl shadow-black/15 border border-slate-200/80 overflow-hidden pointer-events-auto">
        <div className="relative p-4">
          <button
            onClick={handleDismiss}
            aria-label="Dismiss install prompt"
            className="absolute top-3 right-3 p-1.5 rounded-full text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors cursor-pointer"
          >
            <X className="h-4 w-4" />
          </button>

          <div className="flex items-start gap-3 pr-8">
            <div className="shrink-0 w-10 h-10 rounded-xl bg-emerald-50 flex items-center justify-center">
              {isIOS ? (
                <Share className="h-5 w-5 text-emerald-600" />
              ) : (
                <Download className="h-5 w-5 text-emerald-600" />
              )}
            </div>

            <div className="flex-1 min-w-0">
              <h3 className="text-sm font-bold text-slate-900">
                Add to Home Screen
              </h3>
              <p className="text-xs text-slate-500 mt-0.5 leading-relaxed">
                {isIOS
                  ? "Tap the Share icon below, then \"Add to Home Screen\" for faster access and hostel alerts."
                  : "Add a shortcut to your home screen for faster access and instant hostel alerts."}
              </p>
            </div>
          </div>

          <div className="mt-3 flex gap-2">
            <button
              onClick={handleInstall}
              className="flex-1 inline-flex items-center justify-center h-9 rounded-xl bg-emerald-600 text-xs font-bold text-white hover:bg-emerald-500 active:scale-[0.98] transition-all cursor-pointer shadow-sm"
            >
              {isIOS ? "Got it" : "Add Shortcut"}
            </button>
            <button
              onClick={handleDismiss}
              className="h-9 px-4 rounded-xl text-xs font-semibold text-slate-500 hover:bg-slate-50 transition-colors cursor-pointer"
            >
              Not now
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}
