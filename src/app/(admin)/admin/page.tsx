import { createClient } from '@/lib/supabase/server';
import { countActiveListings, countMonthlyLeads, sumPendingCommissions, countActiveAgents } from '@/lib/utils/admin-stats';
import { OverviewClient } from './overview-client';

export default async function OverviewPage() {
  const supabase = await createClient();

  const [
    { data: listings },
    { data: commissions },
    { data: agents },
    { data: allLeads },
  ] = await Promise.all([
    (supabase as any).from('listings').select('is_active'),
    (supabase as any).from('commissions').select('amount, status, agent_id'),
    (supabase as any).from('agents').select('id, name, status'),
    (supabase as any).from('leads').select('id, agent_id, clicked_at'),
  ]);

  const stats = {
    activeListings: countActiveListings(listings ?? []),
    monthlyLeads: countMonthlyLeads(allLeads ?? []),
    pendingCommissionsKes: sumPendingCommissions(commissions ?? []),
    activeAgents: countActiveAgents(agents ?? []),
  };

  return <OverviewClient stats={stats} />;
}
