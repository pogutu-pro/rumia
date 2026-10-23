import { createClient } from '@/lib/auth/server';
import { agentDashboardApi } from '@/lib/api/agent-dashboard';
import { redirect } from 'next/navigation';
import { EnquiriesSection } from '@/components/dashboard/enquiries-section';
import { LeadsTable } from '../leads-table';
import { DashboardPageHeader } from '@/app/(dashboard)/dashboard-ui';

export const revalidate = 0;

export default async function AgentLeadsPage() {
  const authClient = await createClient();
  const {
    data: { user },
  } = await authClient.auth.getUser();
  if (!user) redirect('/auth/login');

  const agent = await agentDashboardApi.getSelf().catch(() => null);

  if (!agent) redirect('/dashboard');

  const [apiListings, leadsPage] = await Promise.all([
    agentDashboardApi.listings().catch(() => []),
    agentDashboardApi.leads().catch(() => ({ items: [], total: 0 })),
  ]);
  const listings = apiListings.map((l) => ({ id: l.id, title: l.title }));
  const leads = leadsPage.items;

  const totalLeads = (leads || []).length;

  return (
    <div className="space-y-6">
      <DashboardPageHeader
        title="Leads"
        description={
          totalLeads > 0
            ? `${totalLeads} lead${totalLeads !== 1 ? 's' : ''} across all your listings.`
            : 'Leads appear when students contact you about a listing.'
        }
      />

      <EnquiriesSection />

      <LeadsTable leads={leads || []} listings={(listings as any) || []} />
    </div>
  );
}
