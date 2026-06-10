"use client";

import { Download } from "lucide-react";
import { usePWAInstall } from "@/hooks/usePWAInstall";

export function InstallButton() {
  const { isInstallable, handleInstall } = usePWAInstall();

  if (!isInstallable) return null;

  return (
    <button
      onClick={handleInstall}
      aria-label="Install Rumia app"
      className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-bold text-white shadow-sm transition-all hover:bg-emerald-500 active:scale-[0.97]"
    >
      <Download className="h-3.5 w-3.5" />
      Install
    </button>
  );
}
