"use client";

import { usePathname } from "next/navigation";
import { usesBottomNav } from "./BottomNav";

/**
 * Adds bottom padding only where the BottomNav is shown (the role workspaces). Everything else uses the
 * application shell. A div, not <main>: pages render their own main landmark.
 */
export function MobileMain({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  return (
    <div className={usesBottomNav(pathname) ? "pb-[calc(4rem+env(safe-area-inset-bottom))] md:pb-0" : undefined}>
      {children}
    </div>
  );
}
