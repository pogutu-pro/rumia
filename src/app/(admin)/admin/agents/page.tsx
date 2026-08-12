import { createClient } from '@/lib/supabase/server';
import { supabaseAdmin } from '@/lib/supabase/admin';
import type { AdminAgent } from '@/types';
import { AgentsTableClient } from './agents-table-client';

export default async function AgentsPage() {
  const supabase = await createClient();

  const { data: agentsRaw } = await (supabase as any).from('agents').select(`
    id, name, phone, whatsapp, status, created_at, user_id, is_featured, is_founder,
    listings(id, is_active),
    leads(id),
    commissions(amount, status)
  `);

  const userIds: string[] = (agentsRaw ?? [])
    .map((a: any) => a.user_id)
    .filter(Boolean);

  let roleMap: Record<string, string> = {};
  if (userIds.length > 0) {
    const { data: profiles } = await supabaseAdmin
      .from('profiles')
      .select('id, role')
      .in('id', userIds);
    roleMap = Object.fromEntries(
      (profiles ?? []).map((p: any) => [p.id, p.role])
    );
  }

  const agents: AdminAgent[] = (agentsRaw ?? []).map((agent: any) => {
    const listings: Array<{ id: string; is_active: boolean }> = agent.listings ?? [];
    const leads: Array<{ id: string }> = agent.leads ?? [];
    const commissions: Array<{ amount: number; status: string }> = agent.commissions ?? [];

    return {
      id: agent.id,
      name: agent.name,
      phone: agent.phone,
      whatsapp: agent.whatsapp,
      status: agent.status,
      created_at: agent.created_at,
      user_id: agent.user_id ?? '',
      active_listings_count: listings.filter((l) => l.is_active === true).length,
      total_leads_count: leads.length,
      pending_commissions_sum: commissions
        .filter((c) => c.status === 'pending')
        .reduce((sum, c) => sum + (c.amount ?? 0), 0),
      role: (roleMap[agent.user_id] as AdminAgent['role']) ?? 'agent',
      is_featured: agent.is_featured ?? false,
      is_founder: agent.is_founder ?? false,
    };
  });

  const { data: campusesRaw } = await supabase
    .from('campuses')
    .select('id, name')
    .order('name');
  
  const campuses = campusesRaw ?? [];

  return <AgentsTableClient agents={agents} campuses={campuses} />;
}
