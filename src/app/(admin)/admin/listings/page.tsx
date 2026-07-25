import { createClient } from '@/lib/supabase/server';
import { ListingsTableClient } from './listings-table-client';

export default async function ListingsPage() {
  const supabase = await createClient();

  const { data: listingsRaw } = await (supabase as any).from('listings').select(`
    id, title, location, price, is_active, created_at, sort_position,
    pays_commission, commission_locked_by_admin,
    agents(id, name),
    leads(id),
    listing_images(r2_url, display_order)
  `);

  const { data: agentsRaw } = await (supabase as any)
    .from('agents')
    .select('id, name, status')
    .order('name');

  const listings = (listingsRaw ?? []).map((listing: any) => {
    const images: Array<{ r2_url: string; display_order: number }> =
      listing.listing_images ?? [];
    const sorted = [...images].sort((a, b) => a.display_order - b.display_order);
    const coverImage: string | null = sorted[0]?.r2_url ?? null;

    return {
      id: listing.id,
      title: listing.title,
      location: listing.location,
      price: listing.price,
      is_active: listing.is_active,
      created_at: listing.created_at,
      sort_position: listing.sort_position ?? null,
      leads_count: listing.leads?.length ?? 0,
      agent_name: listing.agents?.name ?? '—',
      agent_id: listing.agents?.id ?? '',
      cover_image: coverImage,
      pays_commission: listing.pays_commission ?? true,
      commission_locked_by_admin: listing.commission_locked_by_admin ?? false,
    };
  });

  // Sort: positioned listings first (ascending), then unpositioned by created_at DESC
  listings.sort((a: (typeof listings)[number], b: (typeof listings)[number]) => {
    if (a.sort_position !== null && b.sort_position !== null) return a.sort_position - b.sort_position;
    if (a.sort_position !== null) return -1;
    if (b.sort_position !== null) return 1;
    return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
  });

  const agents: Array<{ id: string; name: string; status: string }> = (agentsRaw ?? []).map(
    (a: any) => ({ id: a.id, name: a.name, status: a.status })
  );

  return <ListingsTableClient listings={listings} agents={agents} />;
}
