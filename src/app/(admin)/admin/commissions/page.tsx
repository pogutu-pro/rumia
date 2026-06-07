import { createClient } from '@/lib/supabase/server';
import { sumPendingCommissions } from '@/lib/utils/admin-stats';
import { CommissionsTableClient } from './commissions-table-client';

export default async function CommissionsPage() {
  const supabase = await createClient();

  // Fetch all commissions with agent and listing joins
  const { data: commissionsRaw } = await (supabase as any)
    .from('commissions')
    .select(`
      id, agent_id, amount, status, created_at, paid_at,
      agents(id, name),
      listings(id, title)
    `)
    .order('created_at', { ascending: false });

  // Fetch agents for filter dropdown
  const { data: agentsRaw } = await (supabase as any)
    .from('agents')
    .select('id, name')
    .order('name');

  const commissions = (commissionsRaw ?? []).map((c: any) => ({
    id: c.id,
    agent_id: c.agent_id ?? null,
    amount: c.amount,
    status: c.status as 'pending' | 'paid',
    created_at: c.created_at,
    paid_at: c.paid_at ?? null,
    agents: c.agents ? { id: c.agents.id, name: c.agents.name } : null,
    listings: c.listings ? { id: c.listings.id, title: c.listings.title } : null,
  }));

  const agents: Array<{ id: string; name: string }> = (agentsRaw ?? []).map(
    (a: any) => ({ id: a.id, name: a.name })
  );

  // Compute summary totals server-side
  const totalPending = sumPendingCommissions(commissions);
  const totalPaid = commissions
    .filter((c: { status: string }) => c.status === 'paid')
    .reduce((sum: number, c: { amount: number }) => sum + c.amount, 0);

  return (
    <CommissionsTableClient
      commissions={commissions}
      agents={agents}
      totalPending={totalPending}
      totalPaid={totalPaid}
    />
  );
}
