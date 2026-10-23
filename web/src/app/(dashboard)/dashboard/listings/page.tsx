import { createClient } from '@/lib/auth/server';
import { agentDashboardApi } from '@/lib/api/agent-dashboard';
import { redirect } from 'next/navigation';
import { ListingsList } from '../listings-list';
import { Plus } from 'lucide-react';
import Link from 'next/link';
import { DashboardPageHeader, primaryButton } from '@/app/(dashboard)/dashboard-ui';

export const revalidate = 0;

export default async function AgentListingsPage() {
  const authClient = await createClient();
  const {
    data: { user },
  } = await authClient.auth.getUser();
  if (!user) redirect('/auth/login');

  const agent = await agentDashboardApi.getSelf().catch(() => null);

  if (!agent) redirect('/dashboard');

  if (agent.status === 'suspended') {
    redirect('/dashboard');
  }

  const apiListings = await agentDashboardApi.listings().catch(() => []);
  // The list component reads the legacy `listing_images` key.
  const listings = apiListings.map((l) => ({ ...l, listing_images: l.images }));
  const leadsCountByListing: Record<string, number> = Object.fromEntries(
    apiListings.map((l) => [l.id, l.lead_count]),
  );

  const activeCount = listings?.filter((l: any) => l.is_active).length || 0;

  return (
    <div className="space-y-6">
      <DashboardPageHeader
        title="My listings"
        description={
          activeCount > 0
            ? `${activeCount} active listing${activeCount !== 1 ? 's' : ''} across your portfolio.`
            : 'Manage your hostel listings, photos and availability.'
        }
        actions={
          <Link href="/dashboard/new" className={primaryButton}>
            <Plus className="h-4 w-4" aria-hidden />
            New listing
          </Link>
        }
      />

      <ListingsList
        initialListings={(listings as any) || []}
        leadsCountByListing={leadsCountByListing}
      />
    </div>
  );
}
