import { ReactNode } from 'react';
import { SiteFooter } from '@/components/rumia/site-footer';
import { SiteHeader } from '@/components/rumia/site-header';
import { PublicTelemetry } from '@/components/telemetry/public-telemetry';

interface LayoutProps {
  children: ReactNode;
}

/** Signed-in ops area: same rebuilt chrome as the rest of the product. */
export default function OpsLayout({ children }: LayoutProps) {
  return (
    <div className="flex min-h-screen flex-col bg-rum-surface">
      <SiteHeader />
      <main className="flex-1">{children}</main>
      <PublicTelemetry />
      <SiteFooter />
    </div>
  );
}
