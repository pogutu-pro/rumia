import { createClient } from '@/lib/supabase/server';
import { notFound, redirect } from 'next/navigation';
import { NewListingForm } from '../../new/new-listing-form';
import { ArrowLeft } from 'lucide-react';
import Link from 'next/link';

export const revalidate = 0;

interface EditListingPageProps {
  params: Promise<{ id: string }>;
}

export default async function EditListingPage({ params }: EditListingPageProps) {
  const { id } = await params;
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect('/auth/login');
  }

  const { data: agent } = await supabase
    .from('agents')
    .select('id, phone, whatsapp')
    .eq('user_id', user.id)
    .maybeSingle();

  if (!agent) {
    redirect('/dashboard');
  }

  const { data: listing, error } = await supabase
    .from('listings')
    .select(`
      id, title, description, price, location, youtube_id, room_type,
      amenities, bathroom_type, distance_to_campus,
      security_type, water_included, electricity_included, wifi_included,
      latitude, longitude, gender, proximity_description, is_active,
      county, area,
      listing_images ( id, r2_url, category, display_order )
    `)
    .eq('id', id)
    .eq('agent_id', agent.id)
    .single();

  if (error || !listing) {
    notFound();
  }

  const { data: roomTypes } = await supabase
    .from('listing_room_types')
    .select('id, room_type, price, is_available')
    .eq('listing_id', id);

  (listing as any).listing_room_types = roomTypes || [];

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div>
        <Link
          href="/dashboard"
          className="inline-flex items-center gap-1.5 text-sm font-semibold text-slate-500 hover:text-slate-900 transition-colors mb-2"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Dashboard
        </Link>

        <h1 className="text-3xl font-black text-slate-900 tracking-tight">
          Edit Listing
        </h1>
        <p className="text-slate-500 font-medium mt-1">
          Update address, room details, photos, and publishing status.
        </p>
      </div>

      <NewListingForm
        agentId={agent.id}
        agentWhatsapp={agent.whatsapp || agent.phone || ''}
        initialListing={listing as any}
        mode="edit"
      />
    </div>
  );
}
