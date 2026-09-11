import { createClient } from '@/lib/supabase/server';
import { notFound, redirect } from 'next/navigation';
import { NewListingForm } from '../../new/new-listing-form';
import { ArrowLeft } from 'lucide-react';
import Link from 'next/link';

export const revalidate = 0;

interface EditListingPageProps {
  params: Promise<{ id: string }>;
}

export default async function EditListingPage({
  params,
}: EditListingPageProps) {
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
    .select('id, phone, whatsapp, campus_id, status')
    .eq('user_id', user.id)
    .maybeSingle();

  if (!agent) {
    redirect('/dashboard');
  }

  if (agent.status === 'suspended') {
    redirect('/dashboard');
  }

  const { data: listing, error } = await supabase
    .from('listings')
    .select(
      `id, title, description, property_type, price, location, youtube_id, is_youtube_shorts, room_type,
      amenities, bathroom_type, distance_to_campus,
      security_type, water_included, electricity_included, wifi_included, hot_water_included, cooking_gas_included,
      latitude, longitude, gender, proximity_description, is_active,
      county, area,
      specific_location, price_single, price_sharing, mpesa_details, distance_category,
      landlord_phone,
      listing_images ( id, r2_url, category, display_order, blur_data_url )`,
    )
    .eq('id', id)
    .eq('agent_id', agent.id)
    .single();

  if (error || !listing) {
    notFound();
  }

  const { data: roomTypes } = await supabase
    .from('listing_room_types')
    .select(
      'id, room_type, price, is_available, deposit, furnishing_items, category, occupancy, floor, size',
    )
    .eq('listing_id', id);

  const { data: campusZones } = await supabase
    .from('campus_zones')
    .select('id, name, slug, full_search_price, distance_category')
    .eq('campus_id', agent.campus_id)
    .order('name');

  (listing as any).listing_room_types = roomTypes || [];

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
          Edit Listing
        </h1>
        <p className="text-xs sm:text-sm text-slate-500 mt-1">
          Update address, room details, photos, and publishing status.
        </p>
      </div>

      <NewListingForm
        agentId={agent.id}
        agentWhatsapp={agent.whatsapp || agent.phone || ''}
        initialListing={listing as any}
        mode="edit"
        campusId={agent.campus_id || null}
        campusZones={campusZones || []}
      />
    </div>
  );
}
