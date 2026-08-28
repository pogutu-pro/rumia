import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import { NewListingForm } from './new-listing-form';
import { ArrowLeft } from 'lucide-react';
import Link from 'next/link';

export const revalidate = 0;

export default async function NewListingPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    redirect('/auth/login');
  }

  let { data: agent } = await supabase
    .from('agents')
    .select('id, phone, whatsapp, campus_id, status')
    .eq('user_id', user.id)
    .maybeSingle();

  if (!agent) {
    redirect('/dashboard');
  }

  if (agent.status === 'suspended') {
    redirect('/dashboard');
  }

  const { data: campus } = await supabase
    .from('campuses')
    .select('status')
    .eq('id', agent.campus_id)
    .maybeSingle();

  if (campus?.status === 'suspended') {
    redirect('/dashboard');
  }

  const { data: campusZones } = await supabase
    .from('campus_zones')
    .select('id, name, slug, full_search_price, distance_category')
    .eq('campus_id', agent.campus_id)
    .order('name');

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div>
        <Link
          href="/dashboard"
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-600 hover:text-slate-900 transition-colors mb-3"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Dashboard
        </Link>
        <h1 className="text-lg sm:text-2xl font-bold text-slate-900 tracking-tight">
          Create New Listing
        </h1>
        <p className="text-xs sm:text-sm text-slate-500 mt-1">
          Add a new campus room or hostel to the marketplace.
        </p>
      </div>

      <NewListingForm
        agentId={agent.id}
        agentWhatsapp={agent.whatsapp || agent.phone || ''}
        campusId={agent.campus_id || null}
        campusZones={campusZones || []}
      />
    </div>
  );
}
