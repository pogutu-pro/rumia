import { getManagerHostelsAction, getManagerUser } from '@/app/actions/manager';
import { OfficialHostelsTableClient } from '@/app/(admin)/admin/official-hostels/official-hostels-table-client';

export default async function ManagerHostelsPage() {
  const manager = await getManagerUser();

  if (!manager) {
    return (
      <div className="p-6 bg-rose-50 border border-rose-200 rounded-xl text-rose-800 text-sm">
        Unauthorized: You do not have permission to view manager pages.
      </div>
    );
  }

  const data = await getManagerHostelsAction();

  const officialHostels = data?.officialHostels ?? [];
  const agentListings = data?.agentListings ?? [];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900 tracking-tight">
          Campus Hostels
        </h1>
        <p className="text-sm text-slate-500">
          View agent-uploaded hostels on your campus alongside official housing
          records.
        </p>
      </div>

      <OfficialHostelsTableClient
        officialHostels={officialHostels}
        agentListings={agentListings}
        isFromDb={officialHostels.length > 0}
        readOnly
      />
    </div>
  );
}