'use client';

import { BrandedLoader } from '@/components/ui/branded-loader';

export default function Loading() {
  return (
    <div
      role="status"
      aria-live="polite"
      aria-busy="true"
      aria-label="Loading your account"
      className="flex min-h-[70vh] items-center justify-center bg-white animate-fade-in"
    >
      <BrandedLoader size={120} text="Loading your account" />
      <span className="sr-only">Loading your account</span>
    </div>
  );
}