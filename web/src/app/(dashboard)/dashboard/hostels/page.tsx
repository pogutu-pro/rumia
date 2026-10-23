import { createClient } from '@/lib/auth/server';
import { redirect } from 'next/navigation';
import { getAgentHostelsAction } from '@/app/actions/listings';
import { OfficialHostelsTableClient } from '@/app/(admin)/admin/official-hostels/official-hostels-table-client';
import { DashboardPageHeader } from '@/app/(dashboard)/dashboard-ui';

export default async function AgentHostelsPage() {
  const authClient = await createClient();
  const {
    data: { user },
  } = await authClient.auth.getUser();
  if (!user) {
    redirect('/auth/login');
  }

  const data = await getAgentHostelsAction();
  const officialHostels = data?.officialHostels ?? [];
  const agentHostels = data?.agentListings ?? [];

  return (
    <div className="space-y-6">
      <DashboardPageHeader
        title="Hostels directory"
        description="Official DeKUT housing records alongside every agent-uploaded hostel."
      />

      <OfficialHostelsTableClient
        officialHostels={officialHostels}
        agentListings={agentHostels}
        isFromDb={officialHostels.length > 0}
        readOnly
      />
    </div>
  );
}