import { createClient } from '@/lib/supabase/server';
import { agentDashboardApi } from '@/lib/api/agent-dashboard';
import { redirect } from 'next/navigation';
import { ToursSection } from '../tours-section';
import { ArrowLeft } from 'lucide-react';
import Link from 'next/link';

export const revalidate = 0;

export default async function AgentToursPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/auth/login');

  const agent = await agentDashboardApi.getSelf().catch(() => null);
  if (!agent) redirect('/dashboard');

  const { items } = await agentDashboardApi
    .tours('upcoming')
    .catch(() => ({ items: [] }));
  // The tours section reads the legacy `listings` / `agents` keys.
  const tourBookings = items.map((b) => ({
    ...b,
    listings: b.listing ?? null,
    agents: b.agent ?? null,
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
