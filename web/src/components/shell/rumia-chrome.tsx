import { Suspense } from 'react';
import { BottomNav } from '@/components/pwa/BottomNav';
import { CompareTray } from '@/components/compare/compare-tray';
import { InstallBanner } from '@/components/pwa/InstallBanner';
import { MobileMain } from '@/components/pwa/MobileMain';

/**
 * Rumia's app-wide chrome: bottom navigation, compare tray and install banner. It used to sit in the root layout; it
 * lives in each Rumia layout instead so RumiaBnB (same app, other host) does not inherit it.
 */
export function RumiaChrome({ children }: { children: React.ReactNode }) {
  return (
    <>
      <MobileMain>{children}</MobileMain>
      <CompareTray />
      <Suspense fallback={null}>
        <BottomNav />
      </Suspense>
      <InstallBanner />
    </>
  );
}
