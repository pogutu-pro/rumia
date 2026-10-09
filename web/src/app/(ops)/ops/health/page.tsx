import type { Metadata } from 'next';
import { HealthPanel, OpsNav } from '@/components/rumia/ops/ops-console';

export const metadata: Metadata = { title: 'Market health · Rumia Ops', robots: { index: false, follow: false } };
export const dynamic = 'force-dynamic';

export default async function OpsHealthPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const params = await searchParams;
  const market = typeof params.market === 'string' ? params.market : 'nyeri';
  return (
    <div className="mx-auto max-w-4xl space-y-6 px-4 py-8 lg:px-8">
      <h1 className="text-2xl font-semibold text-rum-text sm:text-3xl">Market health</h1>
      <OpsNav />
      <HealthPanel initialMarket={market} />
    </div>
  );
}
