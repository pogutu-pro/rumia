import { createClient } from '@/lib/auth/server';
import { agentDashboardApi } from '@/lib/api/agent-dashboard';
import { redirect } from 'next/navigation';
import { ToursSection } from '../tours-section';
import { DashboardPageHeader } from '@/app/(dashboard)/dashboard-ui';

export const revalidate = 0;

export default async function AgentToursPage() {
  const authClient = await createClient();
  const { data: { user } } = await authClient.auth.getUser();
  if (!user) redirect('/auth/login');

  const agent = await agentDashboardApi.getSelf().catch(() => null);
  if (!agent) redirect('/dashboard');

  const { items } = await agentDashboardApi
    .tours('upcoming')
    .catch(() => ({ items: [] }));
  // The tours section reads the legacy `listings` / `agents` keys.
  const tourBookings = items.map((b) => ({
    ...b,
    listings: b.listing ?? null,
    agents: b.agent ?? null,
  }));

  return (
    <div className="space-y-6">
      <DashboardPageHeader title="Tours" description="Every viewing students have booked with you, in one place." />
      <ToursSection bookings={tourBookings} />
    </div>
  );
}
