import { supabaseAdmin } from '@/lib/supabase/admin';
import { notFound } from 'next/navigation';
import { getManagerUser } from '@/app/actions/manager';
import { getManagerUserContext, checkManagerCampusScope } from '@/lib/utils/manager';
import { ManagerEditForm } from './manager-edit-form';
import { ArrowLeft } from 'lucide-react';
import Link from 'next/link';

export const revalidate = 0;

interface ManagerEditListingPageProps {
  params: Promise<{ id: string }>;
}

export default async function ManagerEditListingPage({
  params,
}: ManagerEditListingPageProps) {
  const { id } = await params;
  const manager = await getManagerUser();

  if (!manager) {
    notFound();
  }

  const { context } = manager;

  const { data: listing, error } = await supabaseAdmin
    .from('listings')
    .select(
      `id, title, description, price, location, youtube_id, is_youtube_shorts, room_type,
      amenities, bathroom_type, distance_to_campus,
      security_type, water_included, electricity_included, wifi_included,
      latitude, longitude, gender, proximity_description, is_active,
      county, area,
      specific_location, price_single, price_sharing, mpesa_details, distance_category,
      landlord_phone, campus_id, agent_id,
      listing_images ( id, r2_url, category, display_order, blur_data_url ),
      agents ( id, name, phone, whatsapp )`
    )
    .eq('id', id)
    .single();

  if (error || !listing) {
    notFound();
  }

  const agent = (listing as any).agents;

  // Enforce campus scope: a manager may only edit listings within their campus/region.
  if (!context.isSuperAdmin) {
    const isAuthorized = await checkManagerCampusScope(
      supabaseAdmin,
      context,
      listing.campus_id,
    );
    if (!isAuthorized) {
      notFound();
    }
  }

  const { data: roomTypes } = await supabaseAdmin
    .from('listing_room_types')
    .select(
      'id, room_type, price, is_available, deposit, furnishing_items, category, occupancy, floor, size'
    )
    .eq('listing_id', id);

  const { data: campusZones } = await supabaseAdmin
    .from('campus_zones')
    .select('id, name, slug, full_search_price, distance_category')
    .eq('campus_id', listing.campus_id)
    .order('name');

  (listing as any).listing_room_types = roomTypes || [];

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div>
        <Link
          href="/manager/listings"
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-600 hover:text-slate-900 transition-colors mb-3"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Listings
        </Link>
        <h1 className="text-lg sm:text-2xl font-bold text-slate-900 tracking-tight">
          Edit Listing
        </h1>
        <p className="text-xs sm:text-sm text-slate-500 mt-1">
          Manager editing &middot; {agent?.name || 'Unknown agent'}
        </p>
      </div>

      <ManagerEditForm
        agentId={agent?.id || (listing as any).agent_id}
        agentWhatsapp={agent?.whatsapp || agent?.phone || ''}
        initialListing={listing as any}
        campusId={listing.campus_id || null}
        campusZones={campusZones || []}
      />
    </div>
  );
}
