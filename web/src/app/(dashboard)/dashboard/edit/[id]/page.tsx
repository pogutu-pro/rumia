import { createClient } from '@/lib/auth/server';
import { agentDashboardApi } from '@/lib/api/agent-dashboard';
import { listingsApi } from '@/lib/api/listings';
import { toLegacyListingShape } from '@/lib/api/legacy-listing';
import { notFound, redirect } from 'next/navigation';
import { NewListingForm } from '../../new/new-listing-form';
import { DashboardPageHeader } from '@/app/(dashboard)/dashboard-ui';

export const revalidate = 0;

interface EditListingPageProps {
  params: Promise<{ id: string }>;
}

export default async function EditListingPage({
  params,
}: EditListingPageProps) {
  const { id } = await params;
  const authClient = await createClient();

  const {
    data: { user },
  } = await authClient.auth.getUser();

  if (!user) {
    redirect('/auth/login');
  }

  const agent = await agentDashboardApi.getSelf().catch(() => null);

  if (!agent) {
    redirect('/dashboard');
  }

  if (agent.status === 'suspended') {
    redirect('/dashboard');
  }

  // Owner read: includes inactive listings (and 404s for listings that aren't theirs or missing).
  const apiListing = await listingsApi.getByIdAuthenticatedServer(id).catch(() => null);
  if (!apiListing || apiListing.agent?.id !== agent.id) {
    notFound();
  }
  // The form reads the legacy `listing_images` / `listing_room_types` keys.
  const listing = toLegacyListingShape(apiListing);

  const campusZones = await agentDashboardApi.zones(agent.campus_id);

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <DashboardPageHeader back={{ href: '/dashboard/listings', label: 'My listings' }} title="Edit listing" description="Update the address, rooms, photos and whether it is live." />

      <NewListingForm
        agentId={agent.id}
        agentWhatsapp={agent.whatsapp || agent.phone || ''}
        initialListing={listing as any}
        mode="edit"
        campusId={agent.campus_id || null}
        campusZones={campusZones || []}
      />
    </div>
  );
}
