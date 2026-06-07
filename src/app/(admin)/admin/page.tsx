import { createClient } from '@/lib/supabase/server';
import { countActiveListings, countMonthlyLeads, sumPendingCommissions, countActiveAgents } from '@/lib/utils/admin-stats';
import { rankAgentsByLeads } from '@/lib/utils/admin-rankings';
import { OverviewClient } from './overview-client';

export default async function OverviewPage() {
  const supabase = await createClient();

  // Fetch all required data in parallel
  const [
    { data: listings },
    { data: commissions },
    { data: agents },
    { data: allLeads },
    { data: recentLeads },
  ] = await Promise.all([
    (supabase as any).from('listings').select('is_active'),
    (supabase as any).from('commissions').select('amount, status, agent_id'),
    (supabase as any).from('agents').select('id, name, status'),
    (supabase as any).from('leads').select('id, agent_id, listing_id, clicked_at, ip_hash'),
    (supabase as any)
      .from('leads')
      .select('id, clicked_at, ip_hash, listings(id, title), agents(id, name)')
      .order('clicked_at', { ascending: false })
      .limit(10),
  ]);

  const safeListings = listings ?? [];
  const safeCommissions = commissions ?? [];
  const safeAgents = agents ?? [];
  const safeAllLeads = allLeads ?? [];
  const safeRecentLeads = recentLeads ?? [];

  const stats = {
    activeListings: countActiveListings(safeListings),
    monthlyLeads: countMonthlyLeads(safeAllLeads),
    pendingCommissionsKes: sumPendingCommissions(safeCommissions),
    activeAgents: countActiveAgents(safeAgents),
  };

  const topAgents = rankAgentsByLeads(safeAgents, safeAllLeads, safeCommissions);

  return (
    <OverviewClient
      stats={stats}
      recentLeads={safeRecentLeads}
      topAgents={topAgents}
    />
  );
}
