import type { Metadata } from 'next';
import { Suspense } from 'react';
import { HostClaim } from '@/components/bnb/host-claim';

export const metadata: Metadata = { title: 'Your host invite', robots: { index: false, follow: false } };

export default function HostClaimPage() {
  return (
    <div className="mx-auto max-w-md px-4 pb-16 pt-10">
      <Suspense fallback={null}>
        <HostClaim />
      </Suspense>
    </div>
  );
}
