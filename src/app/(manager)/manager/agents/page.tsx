import { getManagerAgentsAction, getManagerUser } from '@/app/actions/manager';
import { AgentsTableClient } from './agents-table-client';

export default async function ManagerAgentsPage() {
  const manager = await getManagerUser();

  if (!manager) {
    return (
      <div className="p-6 bg-rose-50 border border-rose-200 rounded-xl text-rose-800 text-sm">
        Unauthorized access.
      </div>
    );
  }

  const agents = await getManagerAgentsAction();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900 tracking-tight">
          Campus Agent Roster & Standing
        </h1>
        <p className="text-sm text-slate-500">
          Maintain standing among existing agents for your campus (suspend or reinstate account standing).
        </p>
      </div>

      <AgentsTableClient initialAgents={agents as any} />
    </div>
  );
}
