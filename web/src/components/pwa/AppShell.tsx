/**
 * One copy of the legacy chrome for the paths that still need it. The rebuilt public experience has no
 * bottom tab bar (ux/03 §3.1): its pages render their own header and footer and get no wrapper here.
 */
'use client';

import { usePathname } from 'next/navigation';
import { BottomNav } from './BottomNav';
import { MobileMain } from './MobileMain';
import { CompareTray } from '@/components/compare/compare-tray';
import { isPublicPath } from '@/lib/rumia/public-path';

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const legacy = !isPublicPath(pathname);

  if (!legacy) return <>{children}</>;

  return (
    <>
      <MobileMain>{children}</MobileMain>
      <CompareTray />
      <BottomNav />
    </>
  );
}