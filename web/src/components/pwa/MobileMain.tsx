"use client";

import { usePathname } from "next/navigation";

/**
 * MobileMain — lightweight wrapper that adds bottom padding only when
 * the BottomNav is visible (i.e. NOT on hostel detail pages).
 *
 * This replaces AnimatedMain and removes all the framer-motion / swipe
 * navigator overhead that was capturing touch events and blocking
 * native scrolling.
 */
export function MobileMain({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  // BottomNav hides itself on hostel detail pages (/hostels/:county/:area/:slug)
  // so we should not add padding there — the detail page has its own sticky footer.
  const isDetailPage = /^\/hostels\/[^/]+\/[^/]+\/[^/]+/.test(pathname);
  const showBottomPadding = !isDetailPage;

  return (
    <main
      className={
        showBottomPadding
          ? "pb-[calc(4rem+env(safe-area-inset-bottom))] md:pb-0"
          : undefined
      }
    >
      {children}
    </main>
  );
}
