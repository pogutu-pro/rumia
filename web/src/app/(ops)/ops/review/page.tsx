import type { Metadata } from 'next';
import { OpsNav, ReviewPanel } from '@/components/rumia/ops/ops-console';

export const metadata: Metadata = { title: 'Review · Rumia Ops', robots: { index: false, follow: false } };
export const dynamic = 'force-dynamic';

export default function OpsReviewPage() {
  return (
    <div className="mx-auto max-w-4xl space-y-6 px-4 py-8 lg:px-8">
      <h1 className="text-2xl font-semibold text-rum-text sm:text-3xl">Review</h1>
      <OpsNav />
      <ReviewPanel />
    </div>
  );
}
