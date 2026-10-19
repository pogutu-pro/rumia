import type { Metadata } from 'next';
import { Suspense } from 'react';
import { RequestStatus } from '@/components/bnb/request-status';

export const metadata: Metadata = { title: 'Your booking request', robots: { index: false, follow: false } };

/** The guest's private status page. The token is the only key; the page never renders on the server. */
export default async function RequestStatusPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  return (
    <div className="mx-auto max-w-2xl px-4 pb-16 pt-8">
      <Suspense fallback={<p className="text-bnb-stone">Loading your request…</p>}>
        <RequestStatus token={decodeURIComponent(token)} />
      </Suspense>
    </div>
  );
}
