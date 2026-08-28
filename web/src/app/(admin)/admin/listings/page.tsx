import { createClient } from '@/lib/supabase/server';
import { ListingsTableClient } from './listings-table-client';

export default async function ListingsPage() {
  const supabase = await createClient();

  const { data: listingsRaw } = await (supabase as any)
    .from('listings')
    .select(`
      id, title, location, price, is_active, verified, created_at, sort_position, landlord_phone,
      pays_commission, commission_locked_by_admin,
      agents(id, name, verified),
      leads(id),
      listing_images(r2_url, display_order)
    `)
    .order('sort_position', { ascending: true, nullsFirst: false })
    .order('created_at', { ascending: false });

  const { data: agentsRaw } = await (supabase as any)
    .from('agents')
    .select('id, name, status')
    .order('name');

  // Latest reorder timestamp for admin feedback ("last reordered X ago").
  const { data: lastReorderRaw } = await (supabase as any)
    .from('listing_sort_history')
    .select('changed_at')
    .order('changed_at', { ascending: false })
    .limit(1);

  const lastReorderAt: string | null = lastReorderRaw?.[0]?.changed_at ?? null;

  const listings = (listingsRaw ?? []).map((listing: any) => {
    const images: Array<{ r2_url: string; display_order: number }> =
      listing.listing_images ?? [];
    const sorted = [...images].sort((a, b) => a.display_order - b.display_order);
    const coverImage: string | null = sorted[0]?.r2_url ?? null;

    const agentVerified = Array.isArray(listing.agents)
      ? listing.agents[0]?.verified
      : listing.agents?.verified;

    return {
      id: listing.id,
      title: listing.title,
      location: listing.location,
      price: listing.price,
      is_active: listing.is_active,
      verified: listing.verified || agentVerified || false,
      created_at: listing.created_at,
      sort_position: listing.sort_position ?? null,
      leads_count: listing.leads?.length ?? 0,
      agent_name: Array.isArray(listing.agents) ? listing.agents[0]?.name ?? '—' : listing.agents?.name ?? '—',
      agent_id: Array.isArray(listing.agents) ? listing.agents[0]?.id ?? '' : listing.agents?.id ?? '',
      cover_image: coverImage,
      landlord_phone: listing.landlord_phone ?? null,
      pays_commission: listing.pays_commission ?? true,
      commission_locked_by_admin: listing.commission_locked_by_admin ?? false,
    };
  });

  const agents: Array<{ id: string; name: string; status: string }> = (agentsRaw ?? []).map(
    (a: any) => ({ id: a.id, name: a.name, status: a.status })
  );

  // True when any listing has an explicit position, i.e. a custom order is in effect.
  const hasCustomOrder = (listings as Array<{ sort_position: number | null }>).some(
    (l) => l.sort_position !== null,
  );

  return (
    <ListingsTableClient
      listings={listings}
      agents={agents}
      lastReorderAt={lastReorderAt}
      hasCustomOrder={hasCustomOrder}
    />
  );
}
