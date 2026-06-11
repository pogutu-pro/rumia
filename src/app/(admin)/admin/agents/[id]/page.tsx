import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import { AgentDetailClient } from './agent-detail-client';

interface AgentDetailPageProps {
  params: Promise<{ id: string }>;
}

export default async function AgentDetailPage({ params }: AgentDetailPageProps) {
  const { id } = await params;
  const supabase = await createClient();

  const { data, error } = await (supabase as any)
    .from('agents')
    .select(`
      id, name, phone, whatsapp, status, created_at,
      listings(id, title, location, price, is_active),
      leads(id, clicked_at, listing_id, listings(id, title)),
      commissions(id, amount, status, created_at, paid_at, listing_id, listings(id, title))
    `)
    .eq('id', id)
    .single();

  if (!data || error) {
    redirect('/admin/agents');
  }

  let role: string | undefined;
  if (data.user_id) {
    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', data.user_id)
      .maybeSingle();
    role = profile?.role;
  }

  const agent = {
    id: data.id as string,
    name: data.name as string,
    phone: data.phone as string,
    whatsapp: data.whatsapp as string,
    status: data.status as string,
    created_at: data.created_at as string,
    user_id: data.user_id as string,
    role: role as 'student' | 'agent' | 'admin' | undefined,
  };

  const listings = (data.listings ?? []) as Array<{
    id: string;
    title: string;
    location: string;
    price: number;
    is_active: boolean;
  }>;

  const leads = (data.leads ?? []) as Array<{
    id: string;
    clicked_at: string;
    listings: { id: string; title: string } | null;
  }>;

  const commissions = (data.commissions ?? []) as Array<{
    id: string;
    amount: number;
    status: 'pending' | 'paid';
    created_at: string;
    paid_at: string | null;
    listings: { id: string; title: string } | null;
  }>;

  return (
    <AgentDetailClient
      agent={agent}
      listings={listings}
      leads={leads}
      commissions={commissions}
    />
  );
}
