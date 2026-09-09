'use server';

import { revalidatePath } from 'next/cache';
import { listingsApi } from '@/lib/api/listings';
import type {
  OfficialHostel,
  AgentListingHostel,
} from '@/app/(admin)/admin/official-hostels/official-hostels-table-client';
import { createClient } from '@/lib/supabase/server';

function nullableCoordinate(value: unknown) {
  if (value === null || value === undefined || value === '') return null;
  const parsed = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function listingPayload(formData: any, agentId?: string) {
  return {
    title: formData.title,
    county: formData.county || 'nyeri',
    area: formData.area || 'dekut',
    description: formData.description,
    property_type:
      ['apartment', 'short_stay', 'hostel'].includes(formData.property_type)
        ? formData.property_type
        : 'hostel',
    price:
      typeof formData.price === 'number'
        ? formData.price
        : parseFloat(formData.price || formData.price_single || formData.price_sharing) || 0,
    location: formData.location,
    youtube_id: formData.youtube_id || null,
    is_youtube_shorts: !!formData.is_youtube_shorts,
    landlord_phone: formData.landlord_phone || null,
    room_type: formData.room_type,
    amenities: Array.isArray(formData.amenities) ? formData.amenities : [],
    bathroom_type: formData.bathroom_type,
    distance_to_campus: formData.distance_to_campus,
    security_type: formData.security_type,
    electricity_included: !!formData.electricity_included,
    water_included: !!formData.water_included,
    wifi_included: !!formData.wifi_included,
    hot_water_included: !!formData.hot_water_included,
    cooking_gas_included: !!formData.cooking_gas_included,
    latitude: nullableCoordinate(formData.latitude),
    longitude: nullableCoordinate(formData.longitude),
    gender: formData.gender || 'mixed',
    proximity_description: formData.proximity_description || '',
    specific_location: formData.specific_location || null,
    price_single:
      formData.price_single && parseInt(String(formData.price_single)) > 0
        ? parseInt(String(formData.price_single))
        : null,
    price_sharing:
      formData.price_sharing && parseInt(String(formData.price_sharing)) > 0
        ? parseInt(String(formData.price_sharing))
        : null,
    mpesa_details: formData.mpesa_details || null,
    distance_category: formData.distance_category || null,
  };
}

function generateRoomTypeLabel(
  category?: string,
  occupancy?: string | number,
  floor?: string,
  size?: string,
): string {
  if (!category) return '';

  const categoryMap: Record<string, string> = {
    single: 'Single Room',
    double: 'Double Room',
    bedsitter: 'Bedsitter',
    self_contained_bedsitter: 'Self-Contained Bedsitter',
    one_bedroom: '1 Bedroom',
    two_bedroom: '2 Bedroom',
    three_bedroom: '3 Bedroom',
    shared: 'Shared Room',
    other: 'Other',
  };

  let label = categoryMap[category] || category;

  const parts: string[] = [];
  if (floor && floor !== 'na') {
    parts.push(floor === 'ground' ? 'Ground floor' : 'Upper floor');
  }
  if (size && size !== 'standard') {
    parts.push(size === 'smaller' ? 'Smaller' : 'Larger');
  }

  const numOccupancy = typeof occupancy === 'string' ? parseInt(occupancy, 10) : occupancy;
  if (numOccupancy && numOccupancy === 1) {
    parts.push('1 person');
  } else if (numOccupancy && numOccupancy > 1) {
    parts.push(`${numOccupancy} people sharing`);
  }

  if (parts.length > 0) {
    label += ' - ' + parts.join(', ');
  }

  return label;
}

function revalidateListingSurfaces(
  county = 'nyeri',
  area = 'dekut',
  slug?: string | null,
) {
  revalidatePath('/hostels');
  revalidatePath('/dashboard');
  revalidatePath('/admin/listings');
  revalidatePath(`/hostels/${county}/${area}`);

  if (slug) {
    revalidatePath(`/hostels/${county}/${area}/${slug}`);
  }
}

export async function createListingAction(formData: any) {
  try {
    const images = (formData.images || []).map((img: any, idx: number) => ({
      r2_url: img.url || img.r2_url,
      display_order: idx,
      category: img.category || 'Room',
      blur_data_url: img.blurDataUrl || img.blur_data_url || null,
      width: img.width || null,
      height: img.height || null,
      format: img.format || null,
    }));

    const room_types = (formData.roomTypes || [])
      .filter((rt: any) => (rt.room_type || rt.category) && rt.price)
      .map((rt: any) => {
        const hasStructuredFields = !!(
          rt.category ||
          rt.occupancy ||
          rt.floor ||
          rt.size
        );
        const label = hasStructuredFields
          ? generateRoomTypeLabel(rt.category, rt.occupancy, rt.floor, rt.size) ||
            rt.room_type
          : rt.room_type;

        return {
          room_type: label,
          price: Math.round(parseFloat(rt.price)),
          is_available: rt.is_available ?? true,
          deposit:
            rt.deposit && parseInt(rt.deposit) > 0 ? parseInt(rt.deposit) : null,
          furnishing_items: rt.furnishing_items?.length
            ? rt.furnishing_items
            : [],
          category: rt.category || null,
          occupancy: rt.occupancy != null ? String(rt.occupancy) : null,
          floor: rt.floor || null,
          size: rt.size || null,
        };
      });

    const payload = {
      ...listingPayload(formData, formData.agent_id),
      county: formData.county || 'nyeri',
      area: formData.area || 'dekut',
      images,
      room_types,
      agent_whatsapp: formData.agent_whatsapp || null,
    };

    const listing = await listingsApi.createServer(payload);

    const county = listing.county || formData.county || 'nyeri';
    const area = listing.area || formData.area || 'dekut';

    revalidateListingSurfaces(county, area, listing.slug);

    return {
      success: true,
      listingId: listing.id,
      listingUrl: `/hostels/${county}/${area}/${listing.slug}`,
    };
  } catch (error: any) {
    console.error('createListingAction error:', error);
    return {
      success: false,
      error: error.message || error.data?.detail || 'Failed to create listing.',
    };
  }
}

export async function updateListingAction(formData: any) {
  if (!formData.listing_id) {
    return { success: false, error: 'Missing listing id.' };
  }

  try {
    const payload: any = {
      ...listingPayload(formData, formData.agent_id),
      county: formData.county || 'nyeri',
      area: formData.area || 'dekut',
      agent_whatsapp: formData.agent_whatsapp || null,
    };

    if (formData.images) {
      payload.images = (formData.images || []).map((img: any, idx: number) => ({
        r2_url: img.url || img.r2_url,
        display_order: idx,
        category: img.category || 'Room',
        blur_data_url: img.blurDataUrl || img.blur_data_url || null,
        width: img.width || null,
        height: img.height || null,
        format: img.format || null,
      }));
    }

    if (formData.roomTypes) {
      payload.room_types = (formData.roomTypes || [])
        .filter((rt: any) => (rt.room_type || rt.category) && rt.price)
        .map((rt: any) => {
          const hasStructuredFields = !!(
            rt.category ||
            rt.occupancy ||
            rt.floor ||
            rt.size
          );
          const label = hasStructuredFields
            ? generateRoomTypeLabel(rt.category, rt.occupancy, rt.floor, rt.size) ||
              rt.room_type
            : rt.room_type;

          return {
            room_type: label,
            price: Math.round(parseFloat(rt.price)),
            is_available: rt.is_available ?? true,
            deposit:
              rt.deposit && parseInt(rt.deposit) > 0 ? parseInt(rt.deposit) : null,
            furnishing_items: rt.furnishing_items?.length
              ? rt.furnishing_items
              : [],
            category: rt.category || null,
            occupancy: rt.occupancy != null ? String(rt.occupancy) : null,
            floor: rt.floor || null,
            size: rt.size || null,
          };
        });
    }

    const listing = await listingsApi.updateServer(formData.listing_id, payload);

    const county = listing.county || formData.county || 'nyeri';
    const area = listing.area || formData.area || 'dekut';

    revalidateListingSurfaces(county, area, listing.slug);

    return {
      success: true,
      listingId: listing.id,
      listingUrl: `/hostels/${county}/${area}/${listing.slug}`,
    };
  } catch (error: any) {
    console.error('updateListingAction error:', error);
    return {
      success: false,
      error: error.message || error.data?.detail || 'Failed to update listing.',
    };
  }
}

export async function toggleListingActiveAction(
  listingId: string,
): Promise<{ success: boolean; error?: string; isActive?: boolean }> {
  try {
    const current = await listingsApi.getByIdServer(listingId);
    const updated = await listingsApi.toggleActiveServer(listingId, !current.is_active);

    revalidatePath('/dashboard');
    revalidatePath('/dashboard/listings');
    revalidatePath('/hostels');
    revalidatePath('/');
    const county = updated.county || 'nyeri';
    const area = updated.area || 'dekut';
    revalidatePath(`/hostels/${county}/${area}`);
    if (updated.slug) {
      revalidatePath(`/hostels/${county}/${area}/${updated.slug}`);
      revalidatePath(`/listing/${updated.id}`);
    }

    return { success: true, isActive: updated.is_active ?? true };
  } catch (error: any) {
    console.error('toggleListingActiveAction error:', error);
    return {
      success: false,
      error: error.message || error.data?.detail || 'Failed to toggle active status.',
    };
  }
}

export async function toggleListingFullAction(
  listingId: string,
): Promise<{ success: boolean; error?: string; isFull?: boolean }> {
  try {
    const current = await listingsApi.getByIdServer(listingId);
    const updated = await listingsApi.toggleFullServer(listingId, !current.is_full);

    revalidatePath('/dashboard');
    revalidatePath('/dashboard/listings');
    revalidatePath('/hostels');
    revalidatePath('/');
    const county = updated.county || 'nyeri';
    const area = updated.area || 'dekut';
    revalidatePath(`/hostels/${county}/${area}`);
    if (updated.slug) {
      revalidatePath(`/hostels/${county}/${area}/${updated.slug}`);
      revalidatePath(`/listing/${updated.id}`);
    }

    return { success: true, isFull: updated.is_full ?? false };
  } catch (error: any) {
    console.error('toggleListingFullAction error:', error);
    return {
      success: false,
      error: error.message || error.data?.detail || 'Failed to toggle full status.',
    };
  }
}

export async function toggleListingCommissionAction(
  listingId: string,
): Promise<{ success: boolean; error?: string; paysCommission?: boolean }> {
  try {
    const current = await listingsApi.getByIdServer(listingId);
    const updated = await listingsApi.toggleCommissionServer(listingId, !current.pays_commission);

    revalidatePath('/dashboard');
    revalidatePath('/dashboard/listings');
    revalidatePath('/hostels');
    revalidatePath('/');
    const county = updated.county || 'nyeri';
    const area = updated.area || 'dekut';
    revalidatePath(`/hostels/${county}/${area}`);
    if (updated.slug) {
      revalidatePath(`/hostels/${county}/${area}/${updated.slug}`);
      revalidatePath(`/listing/${updated.id}`);
    }

    return { success: true, paysCommission: updated.pays_commission ?? false };
  } catch (error: any) {
    console.error('toggleListingCommissionAction error:', error);
    return {
      success: false,
      error: error.message || error.data?.detail || 'Failed to toggle commission status.',
    };
  }
}

export async function deleteListingAction(
  listingId: string,
): Promise<{ success: boolean; error?: string }> {
  try {
    await listingsApi.deleteServer(listingId);
    revalidatePath('/dashboard');
    revalidatePath('/dashboard/listings');
    revalidatePath('/hostels');
    revalidatePath('/');
    return { success: true };
  } catch (error: any) {
    console.error('deleteListingAction error:', error);
    return {
      success: false,
      error: error.message || error.data?.detail || 'Failed to delete listing.',
    };
  }
}

export async function getAgentHostelsAction(): Promise<{
  officialHostels: OfficialHostel[];
  agentListings: AgentListingHostel[];
} | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return null;

  const [{ data: officialHostels }, { data: listingsRaw }] = await Promise.all([
    (supabase as any)
      .from('dekut_official_hostels')
      .select('*')
      .order('hostel_name', { ascending: true }),
    (supabase as any)
      .from('listings')
      .select(`
        id, title, location, price, is_active, verified, is_full, created_at,
        landlord_phone, mpesa_details, specific_location, county, area, slug,
        agents ( id, name, phone, whatsapp, verified )
      `)
      .order('created_at', { ascending: false }),
  ]);

  const agentListings: AgentListingHostel[] = ((listingsRaw ?? []) as any[]).map(
    (l: any) => ({
      id: l.id,
      title: l.title,
      location: l.location || l.area || 'DeKUT',
      price: l.price,
      is_active: l.is_active,
      verified:
        l.verified ||
        (Array.isArray(l.agents) ? l.agents[0]?.verified : l.agents?.verified) ||
        false,
      is_full: l.is_full ?? false,
      created_at: l.created_at,
      landlord_phone: l.landlord_phone || '',
      mpesa_details: l.mpesa_details || '',
      specific_location: l.specific_location || '',
      county: l.county || 'nyeri',
      area: l.area || 'dekut',
      slug: l.slug,
      agent_name: Array.isArray(l.agents)
        ? l.agents[0]?.name || 'Agent'
        : l.agents?.name || 'Agent',
      agent_phone: Array.isArray(l.agents)
        ? l.agents[0]?.phone || ''
        : l.agents?.phone || '',
      agent_whatsapp: Array.isArray(l.agents)
        ? l.agents[0]?.whatsapp || ''
        : l.agents?.whatsapp || '',
    }),
  );

  return {
    officialHostels: (officialHostels as OfficialHostel[]) || [],
    agentListings,
  };
}
