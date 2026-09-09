"use client";

import { useEffect, useState, useCallback } from "react";
import { usePathname } from "next/navigation";

const STORAGE_KEY = "rumia_swipe_hint_shown";

export function GestureTutorial() {
  const pathname = usePathname();
  const [visible, setVisible] = useState(false);
  const [fading, setFading] = useState(false);

  const dismiss = useCallback(() => {
    setFading(true);
    setTimeout(() => {
      setVisible(false);
      localStorage.setItem(STORAGE_KEY, "true");
    }, 400);
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (window.innerWidth >= 768) return;
    if (localStorage.getItem(STORAGE_KEY)) return;
    if (pathname.startsWith("/hostels/")) return;

    const showTimer = setTimeout(() => setVisible(true), 600);
    const hideTimer = setTimeout(() => dismiss(), 5000);

    return () => {
      clearTimeout(showTimer);
      clearTimeout(hideTimer);
    };
  }, [pathname, dismiss]);

  if (!visible) return null;

  return (
    <div
      aria-hidden="true"
      className="fixed left-1/2 -translate-x-1/2 z-50 pointer-events-none"
      style={{
        bottom: "calc(4rem + env(safe-area-inset-bottom) + 16px)",
        opacity: fading ? 0 : 1,
        transition: fading ? "opacity 400ms ease-out" : "opacity 300ms ease-in",
      }}
    >
      <div className="flex items-center gap-2.5 bg-gradient-to-r from-emerald-600 to-emerald-500 text-white text-sm font-semibold px-4 py-2.5 rounded-xl shadow-lg shadow-emerald-600/25 whitespace-nowrap select-none">
        <svg
          className="swipe-hint-icon shrink-0"
          width="18"
          height="18"
          viewBox="0 0 20 20"
          fill="none"
          aria-hidden="true"
        >
          <path
            d="M7 10H3M3 10L5.5 7.5M3 10L5.5 12.5"
            stroke="currentColor" strokeWidth="1.5"
            strokeLinecap="round" strokeLinejoin="round"
          />
          <path
            d="M13 10H17M17 10L14.5 7.5M17 10L14.5 12.5"
            stroke="currentColor" strokeWidth="1.5"
            strokeLinecap="round" strokeLinejoin="round"
          />
        </svg>
        <span>Swipe between pages</span>
        <button
          onClick={(e) => { e.stopPropagation(); dismiss(); }}
          className="pointer-events-auto ml-1 inline-flex items-center justify-center rounded-full bg-white/20 p-0.5 transition-colors hover:bg-white/30"
          aria-label="Dismiss hint"
        >
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
            <path d="M3 3L11 11M11 3L3 11" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
          </svg>
        </button>
      </div>
    </div>
  );
}
