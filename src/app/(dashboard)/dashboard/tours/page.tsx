import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import { ToursSection } from '../tours-section';

export const revalidate = 0;

export default async function AgentToursPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/auth/login');

  const { data: agent } = await supabase
    .from('agents')
    .select('id')
    .eq('user_id', user.id)
    .maybeSingle();

  if (!agent) redirect('/dashboard');

  const { data: tourBookingsRaw } = await (supabase as any)
    .from('tour_bookings')
    .select(`
      *,
      listings(id, title, area),
      agents(id, name)
    `)
    .eq('agent_id', agent.id)
    .order('preferred_date', { ascending: true })
    .order('preferred_time', { ascending: true });

  const tourBookings = (tourBookingsRaw ?? []).map((b: any) => ({
    ...b,
    listings: b.listings ?? null,
    agents: b.agents ?? null,
  }));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-black text-slate-900 tracking-tight">Tour Bookings</h1>
        <p className="text-sm text-slate-500 font-medium mt-1">
          Manage all your scheduled hostel tours in one place.
        </p>
      </div>
      <ToursSection bookings={tourBookings} />
    </div>
  );
}
