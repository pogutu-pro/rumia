"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";

const STORAGE_KEY = "rumia_swipe_hint_shown";

export function GestureTutorial() {
  const pathname = usePathname();
  const [visible, setVisible] = useState(false);
  const [fading, setFading] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (window.innerWidth >= 768) return;
    if (localStorage.getItem(STORAGE_KEY)) return;

    if (pathname.startsWith("/hostels/")) return;

    const showTimer = setTimeout(() => setVisible(true), 800);
    const hideTimer = setTimeout(() => dismiss(), 4500);

    return () => {
      clearTimeout(showTimer);
      clearTimeout(hideTimer);
    };
  }, []);

  const dismiss = () => {
    setFading(true);
    setTimeout(() => {
      setVisible(false);
      localStorage.setItem(STORAGE_KEY, "true");
    }, 400);
  };

  if (!visible) return null;

  return (
    <div
      aria-hidden="true"
      className="fixed left-1/2 -translate-x-1/2 z-50 pointer-events-none"
      style={{
        bottom: "calc(4rem + env(safe-area-inset-bottom) + 12px)",
        opacity: fading ? 0 : 1,
        transition: fading ? "opacity 400ms ease-out" : "opacity 300ms ease-in",
      }}
    >
      <div className="flex items-center gap-2 bg-gray-900/80 backdrop-blur-sm text-white text-sm font-medium px-4 py-2 rounded-full whitespace-nowrap select-none">
        <svg
          className="swipe-hint-icon"
          width="20"
          height="20"
          viewBox="0 0 20 20"
          fill="none"
          aria-hidden="true"
        >
          <path
            d="M7 10H3M3 10L5.5 7.5M3 10L5.5 12.5"
            stroke="white" strokeWidth="1.5"
            strokeLinecap="round" strokeLinejoin="round"
          />
          <path
            d="M13 10H17M17 10L14.5 7.5M17 10L14.5 12.5"
            stroke="white" strokeWidth="1.5"
            strokeLinecap="round" strokeLinejoin="round"
          />
        </svg>
        <span>Swipe to navigate</span>
      </div>
    </div>
  );
}
