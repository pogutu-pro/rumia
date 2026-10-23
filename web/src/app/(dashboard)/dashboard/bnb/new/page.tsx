import { createClient } from '@/lib/auth/server';
import { agentDashboardApi } from '@/lib/api/agent-dashboard';
import { redirect } from 'next/navigation';
import { marketForAgentCampus } from '@/lib/data/agent-market';
import { BnbListingForm } from './bnb-listing-form';
import { DashboardPageHeader } from '@/app/(dashboard)/dashboard-ui';

export const revalidate = 0;

export default async function NewBnbListingPage() {
  const authClient = await createClient();
  const { data: { user } } = await authClient.auth.getUser();
  if (!user) redirect('/auth/login');

  const agent = await agentDashboardApi.getSelf().catch(() => null);

  if (!agent || agent.status === 'suspended') redirect('/dashboard');

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <DashboardPageHeader
        back={{ href: '/dashboard/bnb', label: 'RumiaBnB' }}
        title="New short stay"
        description="List your short-stay property on RumiaBnB."
      />

      <BnbListingForm agentWhatsapp={agent.whatsapp} county={await marketForAgentCampus(agent.campus_id)} />
    </div>
  );
}
