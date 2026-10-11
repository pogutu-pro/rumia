"use client";

/**
 * Reserves room for the fixed bottom bar so the last piece of content is always reachable. `--bottom-nav-h` is 0
 * whenever the bar is hidden (property pages, from `lg` up). A div, not <main>: pages render their own landmark.
 */
export function MobileMain({ children }: { children: React.ReactNode }) {
  return <div className="pb-[var(--bottom-nav-h)]">{children}</div>;
}
