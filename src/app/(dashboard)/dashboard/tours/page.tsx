import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import { ToursSection } from '../tours-section';
import { ArrowLeft } from 'lucide-react';
import Link from 'next/link';

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
        <Link
          href="/dashboard"
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-600 hover:text-slate-900 transition-colors mb-3"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Dashboard
        </Link>
        <h1 className="text-lg sm:text-2xl font-bold text-slate-900 tracking-tight">
          Tour Bookings
        </h1>
        <p className="text-xs sm:text-sm text-slate-500 mt-1">
          Manage all your scheduled hostel tours in one place.
        </p>
      </div>
      <ToursSection bookings={tourBookings} />
    </div>
  );
}
