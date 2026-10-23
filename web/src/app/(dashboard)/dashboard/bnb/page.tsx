import { createClient } from '@/lib/auth/server';
import { agentDashboardApi } from '@/lib/api/agent-dashboard';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import { Plus } from 'lucide-react';
import { BnbListingsClient } from './bnb-listings-client';
import { DashboardPageHeader, primaryButton } from '@/app/(dashboard)/dashboard-ui';

export const revalidate = 0;

export default async function BnbDashboardPage() {
  const authClient = await createClient();
  const { data: { user } } = await authClient.auth.getUser();
  if (!user) redirect('/auth/login');

  const agent = await agentDashboardApi.getSelf().catch(() => null);

  if (!agent || agent.status === 'suspended') redirect('/dashboard');

  const apiListings = await agentDashboardApi.listings('short_stay').catch(() => []);
  // The list reads the legacy `listing_images` key.
  const listings = apiListings.map((l) => ({ ...l, listing_images: l.images }));

  const activeCount = listings.filter((l: any) => l.is_active).length;

  return (
    <div className="space-y-6">
      <DashboardPageHeader
        title="RumiaBnB"
        badge={
          <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-primary">
            Short stays
          </span>
        }
        description={
          listings?.length
            ? `${activeCount} active listing${activeCount !== 1 ? 's' : ''}`
            : 'List your short-stay property and reach guests across Kenya.'
        }
        actions={
          <Link href="/dashboard/bnb/new" className={primaryButton}>
            <Plus className="h-4 w-4" aria-hidden />
            New short stay
          </Link>
        }
      />

      <BnbListingsClient initialListings={(listings as any[]) ?? []} />
    </div>
  );
}
