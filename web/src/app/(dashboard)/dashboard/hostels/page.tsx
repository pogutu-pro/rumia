import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import { getAgentHostelsAction } from '@/app/actions/listings';
import { OfficialHostelsTableClient } from '@/app/(admin)/admin/official-hostels/official-hostels-table-client';

export default async function AgentHostelsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    redirect('/auth/login');
  }

  const data = await getAgentHostelsAction();
  const officialHostels = data?.officialHostels ?? [];
  const agentHostels = data?.agentListings ?? [];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900 tracking-tight">
          Hostels Directory
        </h1>
        <p className="text-sm text-slate-500">
          Official DeKUT housing records alongside all agent-uploaded hostels.
        </p>
      </div>

      <OfficialHostelsTableClient
        officialHostels={officialHostels}
        agentListings={agentHostels}
        isFromDb={officialHostels.length > 0}
        readOnly
      />
    </div>
  );
}