'use client';

import * as React from 'react';
import { Toaster } from 'sonner';
import { GoogleAuthModalProvider } from '@/components/google-auth-modal';

interface ProvidersProps {
  children: React.ReactNode;
}

export function Providers({ children }: ProvidersProps) {
  return (
    <GoogleAuthModalProvider>
      {children}
      <Toaster position="top-right" richColors />
    </GoogleAuthModalProvider>
  );
}
