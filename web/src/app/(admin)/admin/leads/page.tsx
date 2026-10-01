import { LeadsTableClient } from './leads-table-client';
import { adminConsoleApi } from '@/lib/api/admin-console';

export default async function LeadsPage() {
  const data = await adminConsoleApi
    .leads()
    .catch(() => ({ leads: [], agents: [], listings: [] }));
  const leads = data.leads as any[];
  const agents = data.agents.map((a) => ({ id: a.id, name: a.name }));
  const listings = data.listings;

  return <LeadsTableClient leads={leads} agents={agents} listings={listings} />;
}
