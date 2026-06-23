import { supabaseAdmin } from '@/lib/supabase/admin';
import { TransfersTableClient } from './transfers-table-client';

export default async function TransfersPage() {
  const { data: transfersRaw } = await supabaseAdmin
    .from('transfer_history')
    .select('*')
    .order('transferred_at', { ascending: false });

  const transfers = await Promise.all(
    (transfersRaw ?? []).map(async (t: any) => {
      const { data: listing } = await supabaseAdmin
        .from('listings')
        .select('title')
        .eq('id', t.listing_id)
        .single();

      const { data: prevOwner } = await supabaseAdmin
        .from('agents')
        .select('name')
        .eq('id', t.previous_owner_id)
        .single();

      const { data: newOwner } = await supabaseAdmin
        .from('agents')
        .select('name')
        .eq('id', t.new_owner_id)
        .single();

      return {
        id: t.id,
        listing_id: t.listing_id,
        previous_owner_id: t.previous_owner_id,
        new_owner_id: t.new_owner_id,
        transferred_by: t.transferred_by,
        transferred_at: t.transferred_at,
        listing_title: listing?.title ?? '—',
        previous_owner_name: prevOwner?.name ?? '—',
        new_owner_name: newOwner?.name ?? '—',
      };
    })
  );

  return <TransfersTableClient transfers={transfers} />;
}
