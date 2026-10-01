import { ToursTableClient } from './tours-table-client';
import { adminConsoleApi } from '@/lib/api/admin-console';
import { agentDashboardApi } from '@/lib/api/agent-dashboard';

export default async function AdminToursPage() {
  const [{ items }, agentRows] = await Promise.all([
    agentDashboardApi.tours('upcoming').catch(() => ({ items: [] })),
    adminConsoleApi.agents().catch(() => []),
  ]);
  // The table reads the legacy `listings` / `agents` keys.
  const tours = items.map((t) => ({ ...t, listings: t.listing ?? null, agents: t.agent ?? null }));
  const agents = agentRows.map((a) => ({ id: a.id, name: a.name }));

  const zoneSet = new Set<string>();
  for (const t of tours) {
    if (t.zone) zoneSet.add(t.zone);
  }
  const zones: string[] = Array.from(zoneSet).sort();
  return (
    <ToursTableClient tours={tours} agents={agents} zones={zones} />
  );
}
