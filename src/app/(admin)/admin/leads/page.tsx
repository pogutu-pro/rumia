import { createClient } from '@/lib/supabase/server';
import { LeadsTableClient } from './leads-table-client';

export default async function LeadsPage() {
  const supabase = await createClient();

  // Fetch all leads with listing and agent joins
  const { data: leadsRaw } = await (supabase as any)
    .from('leads')
    .select(`
      id, agent_id, listing_id, clicked_at, ip_hash, contact_type, name, phone,
      listings(id, title),
      agents(id, name)
    `)
    .order('clicked_at', { ascending: false });

  // Fetch agents for filter dropdown
  const { data: agentsRaw } = await (supabase as any)
    .from('agents')
    .select('id, name')
    .order('name');

  // Fetch listings for filter dropdown
  const { data: listingsRaw } = await (supabase as any)
    .from('listings')
    .select('id, title')
    .order('title');

  const leads = (leadsRaw ?? []).map((lead: any) => ({
    id: lead.id,
    agent_id: lead.agent_id ?? null,
    listing_id: lead.listing_id ?? null,
    clicked_at: lead.clicked_at,
    ip_hash: lead.ip_hash,
    contact_type: lead.contact_type ?? null,
    name: lead.name ?? null,
    phone: lead.phone ?? null,
    listings: lead.listings
      ? { id: lead.listings.id, title: lead.listings.title }
      : null,
    agents: lead.agents
      ? { id: lead.agents.id, name: lead.agents.name }
      : null,
  }));

  const agents: Array<{ id: string; name: string }> = (agentsRaw ?? []).map(
    (a: any) => ({ id: a.id, name: a.name })
  );

  const listings: Array<{ id: string; title: string }> = (listingsRaw ?? []).map(
    (l: any) => ({ id: l.id, title: l.title })
  );

  return <LeadsTableClient leads={leads} agents={agents} listings={listings} />;
}
