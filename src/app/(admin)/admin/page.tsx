import { createClient } from '@/lib/supabase/server';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { OverviewClient } from './overview-client';

// Compute all four stat cards with aggregate (count/sum-scoped) queries instead
// of streaming entire tables into memory on every admin visit.
function startOfMonthUtc(date = new Date()): string {
  return new Date(
    Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1),
  ).toISOString();
}

export default async function OverviewPage() {
  const supabase = await createClient();

  const [
    { count: activeListings },
    { data: pendingCommissions },
    { count: activeAgents },
    { count: monthlyLeads },
    { count: campusCount },
    { count: regionCount },
    { count: managerCount },
  ] = await Promise.all([
    (supabase as any)
      .from('listings')
      .select('id', { count: 'exact', head: true })
      .eq('is_active', true),
    (supabase as any)
      .from('commissions')
      .select('amount')
      .eq('status', 'pending'),
    (supabase as any)
      .from('agents')
      .select('id', { count: 'exact', head: true })
      .eq('status', 'active'),
    (supabase as any)
      .from('leads')
      .select('id', { count: 'exact', head: true })
      .gte('clicked_at', startOfMonthUtc()),
    supabaseAdmin.from('campuses').select('id', { count: 'exact', head: true }),
    supabaseAdmin.from('regions').select('id', { count: 'exact', head: true }),
    supabaseAdmin.from('profiles').select('id', { count: 'exact', head: true }).eq('role', 'manager'),
  ]);

  const pendingRows = (pendingCommissions ?? []) as Array<{ amount: number }>;
  let pendingCommissionsKes = 0;
  for (const row of pendingRows) {
    pendingCommissionsKes += Number(row.amount ?? 0);
  }

  const stats = {
    activeListings: activeListings ?? 0,
    monthlyLeads: monthlyLeads ?? 0,
    pendingCommissionsKes,
    activeAgents: activeAgents ?? 0,
    totalCampuses: campusCount ?? 0,
    totalRegions: regionCount ?? 0,
    totalManagers: managerCount ?? 0,
  };

  return <OverviewClient stats={stats} />;
}
