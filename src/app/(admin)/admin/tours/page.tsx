import { createClient } from '@/lib/supabase/server';
import { ToursTableClient } from './tours-table-client';

export default async function AdminToursPage() {
  const supabase = await createClient();

  const { data: toursRaw } = await (supabase as any)
    .from('tour_bookings')
    .select(`
      *,
      listings(id, title, area),
      agents(id, name)
    `)
    .order('preferred_date', { ascending: true })
    .order('preferred_time', { ascending: true });

  const { data: agentsRaw } = await (supabase as any)
    .from('agents')
    .select('id, name')
    .order('name');

  const tours = (toursRaw ?? []).map((t: any) => ({
    ...t,
    listings: t.listings ?? null,
    agents: t.agents ?? null,
  }));

  const agents: Array<{ id: string; name: string }> = (agentsRaw ?? []).map(
    (a: any) => ({ id: a.id, name: a.name }),
  );

  const zoneSet = new Set<string>();
  for (const t of tours) {
    if (t.zone) zoneSet.add(t.zone);
  }
  const zones: string[] = Array.from(zoneSet).sort();

  return (
    <ToursTableClient tours={tours} agents={agents} zones={zones} />
  );
}
