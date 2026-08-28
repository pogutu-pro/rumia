'use client';

import * as React from 'react';
import { Toaster } from 'sonner';
import { PostHogProvider } from '@/components/providers/posthog-provider';

interface ProvidersProps {
  children: React.ReactNode;
}

export function Providers({ children }: ProvidersProps) {
  return (
    <PostHogProvider>
      {children}
      <Toaster position="top-right" richColors />
    </PostHogProvider>
  );
}
