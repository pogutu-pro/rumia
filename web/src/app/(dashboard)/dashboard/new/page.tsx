import { createClient } from '@/lib/auth/server';
import { agentDashboardApi } from '@/lib/api/agent-dashboard';
import { redirect } from 'next/navigation';
import { NewListingForm } from './new-listing-form';
import { slugifySegment } from '@/lib/utils/listing-path';
import { DashboardPageHeader } from '@/app/(dashboard)/dashboard-ui';
import { campusesServerApi } from '@/lib/api/campuses.server';

export const revalidate = 0;

export default async function NewListingPage() {
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

  const [campuses, campusZones] = await Promise.all([
    campusesServerApi.listServer('active,coming_soon,suspended').catch(() => []),
    agentDashboardApi.zones(agent.campus_id),
  ]);
  const campus = campuses.find((c) => c.id === agent.campus_id);

  if (campus?.status === 'suspended') {
    redirect('/dashboard');
  }

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <DashboardPageHeader back={{ href: '/dashboard/listings', label: 'My listings' }} title="New listing" description="Add a hostel or room near campus to the marketplace." />

      <NewListingForm
        agentId={agent.id}
        agentWhatsapp={agent.whatsapp || agent.phone || ''}
        campusId={agent.campus_id || null}
        campusZones={campusZones || []}
        county={campus?.city ? slugifySegment(campus.city) : undefined}
      />
    </div>
  );
}
