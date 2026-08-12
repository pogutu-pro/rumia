import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import { ListingsList } from '../listings-list';
import { ArrowLeft, Plus } from 'lucide-react';
import Link from 'next/link';

export const revalidate = 0;

export default async function AgentListingsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/auth/login');

  const { data: agent } = await supabase
    .from('agents')
    .select('id, status')
    .eq('user_id', user.id)
    .maybeSingle();

  if (!agent) redirect('/dashboard');

  if (agent.status === 'suspended') {
    redirect('/dashboard');
  }

  const { data: listings } = await supabase
    .from('listings')
    .select(
      `id, title, price, location, is_active, pays_commission,
       commission_locked_by_admin,
       listing_images(r2_url)`
    )
    .eq('agent_id', agent.id)
    .order('id', { ascending: false });

  const { data: leads } = await supabase
    .from('leads')
    .select('listing_id')
    .eq('agent_id', agent.id);

  const leadsCountByListing: Record<string, number> = {};
  (leads || []).forEach((lead: any) => {
    leadsCountByListing[lead.listing_id] =
      (leadsCountByListing[lead.listing_id] || 0) + 1;
  });

  const activeCount = listings?.filter((l: any) => l.is_active).length || 0;

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <Link
            href="/dashboard"
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-600 hover:text-slate-900 transition-colors mb-3"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to Dashboard
          </Link>
          <h1 className="text-lg sm:text-2xl font-bold text-slate-900 tracking-tight">
            My Listings
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 mt-1">
            {activeCount > 0
              ? `${activeCount} active listing${activeCount !== 1 ? 's' : ''} across your portfolio.`
              : 'Manage your hostel listings, photos, and availability.'}
          </p>
        </div>
        <Link
          href="/dashboard/new"
          className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold transition-colors shadow-sm self-start sm:self-auto"
        >
          <Plus className="h-3.5 w-3.5" />
          New Listing
        </Link>
      </div>

      <ListingsList
        initialListings={(listings as any) || []}
        leadsCountByListing={leadsCountByListing}
      />
    </div>
  );
}
