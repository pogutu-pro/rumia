"use client";

import { WifiOff } from "lucide-react";

export default function OfflinePage() {
  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center px-4">
      <div className="max-w-sm w-full text-center space-y-6">
        <div className="mx-auto w-16 h-16 rounded-full bg-slate-100 flex items-center justify-center">
          <WifiOff className="h-8 w-8 text-slate-400" />
        </div>
        <div className="space-y-2">
          <h1 className="text-xl font-bold text-slate-900">
            You&apos;re offline
          </h1>
          <p className="text-sm text-slate-500 leading-relaxed">
            Connect to the internet to browse hostels and get the latest
            listings near DeKUT.
          </p>
        </div>
        <button
          onClick={() => window.location.reload()}
          className="inline-flex items-center justify-center h-10 px-6 rounded-xl bg-slate-900 text-sm font-semibold text-white hover:bg-slate-800 active:scale-[0.98] transition-all"
        >
          Try again
        </button>
      </div>
    </div>
  );
}
