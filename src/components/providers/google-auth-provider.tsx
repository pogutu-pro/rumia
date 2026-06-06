'use client';

import React from 'react';
import { GoogleOAuthProvider } from '@react-oauth/google';

interface GoogleAuthProviderProps {
  children: React.ReactNode;
}

export function GoogleAuthProvider({ children }: GoogleAuthProviderProps) {
  const clientId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID || 'mock-client-id';

  if (clientId === 'mock-client-id') {
    console.warn(
      'Google Client ID is missing. Google Auth will not work correctly. Please add NEXT_PUBLIC_GOOGLE_CLIENT_ID to your .env file.'
    );
  }

  return (
    <GoogleOAuthProvider clientId={clientId}>
      {children}
    </GoogleOAuthProvider>
  );
}
