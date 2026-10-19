import type { Metadata } from 'next';
import { Suspense } from 'react';
import { HostSignIn } from '@/components/bnb/host-sign-in';

export const metadata: Metadata = { title: 'Host sign-in', robots: { index: false } };

export default function HostSignInPage() {
  return (
    <div className="px-4 pb-16 pt-10">
      <Suspense fallback={null}>
        <HostSignIn />
      </Suspense>
    </div>
  );
}
