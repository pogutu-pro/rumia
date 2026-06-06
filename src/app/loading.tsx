'use client';

import { BrandedLoader } from '@/components/ui/branded-loader';

export default function Loading() {
  return (
    <div
      role="status"
      aria-live="polite"
      aria-busy="true"
      aria-label="Loading content"
      className="fixed inset-0 z-50 flex min-h-screen items-center justify-center bg-background"
    >
      <BrandedLoader size={180} />
      <span className="sr-only">Preparing your Rumia experience</span>
    </div>
  );
}
