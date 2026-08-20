'use server';

import { createClient } from '@/lib/supabase/server';
import { revalidatePath } from 'next/cache';
import { generateListingSlug, uniqueSlug } from '@/lib/utils/string';
import { sendPushToUsers } from '@/lib/push';
import {
  verifyListingAgainstOfficial,
  buildOfficialPhoneIndex,
  parseOfficialRecord,
  type OfficialDeKutRecord,
} from '@/lib/utils/dekut-verification';
import { normalizeCampusAreaSelection } from '@/lib/utils/campus-zones';
import officialRecordsData from '@/lib/data/dekut-official-records.json';
import type {
  OfficialHostel,
  AgentListingHostel,
} from '@/app/(admin)/admin/official-hostels/official-hostels-table-client';

const OFFICIAL_RECORDS: OfficialDeKutRecord[] = officialRecordsData.map((r) =>
  parseOfficialRecord(r),
);
const OFFICIAL_PHONE_INDEX = buildOfficialPhoneIndex(OFFICIAL_RECORDS);

function nullableCoordinate(value: unknown) {
  if (value === null || value === undefined || value === '') return null;
  const parsed = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function cleanText(value: unknown) {
  return typeof value === 'string' ? value.trim() : '';
}

function listingPayload(formData: any, agentId: string) {
  return {
    title: formData.title,
    county: formData.county || 'nyeri',
    area: formData.area || 'dekut',
    description: formData.description,
    price:
      typeof formData.price === 'number'
        ? formData.price
        : parseFloat(formData.price || formData.price_single || formData.price_sharing) || 0,
    location: formData.location,
    agent_id: agentId,
    youtube_id: formData.youtube_id || null,
    is_youtube_shorts: !!formData.is_youtube_shorts,
    is_active: formData.is_active,
    landlord_phone: formData.landlord_phone || null,
    room_type: formData.room_type,
    amenities: formData.amenities,
    bathroom_type: formData.bathroom_type,
    distance_to_campus: formData.distance_to_campus,
    security_type: formData.security_type,
    electricity_included: formData.electricity_included,
    water_included: formData.water_included,
    wifi_included: formData.wifi_included,
    hot_water_included: formData.hot_water_included || false,
    cooking_gas_included: formData.cooking_gas_included || false,
    latitude: nullableCoordinate(formData.latitude),
    longitude: nullableCoordinate(formData.longitude),
    gender: formData.gender || 'mixed',
    proximity_description: formData.proximity_description || '',
    // New hostel detail fields
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

async function updateAgentWhatsapp(
  supabase: any,
  agentId: string,
  value: unknown,
) {
  const whatsapp = cleanText(value);

  if (!whatsapp) {
    return {
      success: false,
      error: 'Please enter your agent WhatsApp number.',
    };
  }

  const { error } = await supabase
    .from('agents')
    .update({ whatsapp })
    .eq('id', agentId);

  if (error) {
    console.error('Agent WhatsApp update error:', error);
    return { success: false, error: 'Failed to update agent WhatsApp number.' };
  }

  return { success: true };
}

async function replaceListingImages(
  supabase: any,
  listingId: string,
  images: any[] = [],
) {
  const { error: deleteError } = await supabase
    .from('listing_images')
    .delete()
    .eq('listing_id', listingId);

  if (deleteError) {
    return deleteError;
  }

  if (!images.length) return null;

  const imageInserts = images.map((img: any, idx: number) => ({
    listing_id: listingId,
    r2_url: img.url,
    display_order: idx,
    category: img.category || 'Room',
    blur_data_url: img.blurDataUrl || img.blur_data_url || null,
    width: img.width || null,
    height: img.height || null,
    format: img.format || null,
    image_upload_id: img.imageUploadId || img.image_upload_id || null,
  }));

  const { error } = await supabase.from('listing_images').insert(imageInserts);
  return error;
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

function deriveFurnishingLevel(items: string[] | undefined | null): string {
  if (!items || items.length === 0) return 'empty';
  if (items.length <= 3) return 'semi_furnished';
  return 'furnished';
}

async function replaceRoomTypes(
  supabase: any,
  listingId: string,
  roomTypes: any[] = [],
) {
  const { error: deleteError } = await supabase
    .from('listing_room_types')
    .delete()
    .eq('listing_id', listingId);

  if (deleteError) {
    return deleteError;
  }

  const validRoomTypes = roomTypes
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
        listing_id: listingId,
        room_type: label,
        price: Math.round(parseFloat(rt.price)),
        is_available: rt.is_available,
        deposit:
          rt.deposit && parseInt(rt.deposit) > 0 ? parseInt(rt.deposit) : null,
        furnishing_items: rt.furnishing_items?.length
          ? rt.furnishing_items
          : null,
        category: rt.category || null,
        occupancy: rt.occupancy != null ? String(rt.occupancy) : null,
        floor: rt.floor || null,
        size: rt.size || null,
      };
    });

  if (validRoomTypes.length === 0) return null;

  const { error } = await supabase
    .from('listing_room_types')
    .insert(validRoomTypes);
  return error;
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
  const supabase = await createClient();

  // Verify authentication securely on the server
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return { success: false, error: 'Unauthorized. Please log in.' };
  }

  // Verify the agent profile exists and matches the user
  const { data: agent, error: agentError } = await supabase
    .from('agents')
    .select('id, campus_id')
    .eq('user_id', user.id)
    .single();

  if (agentError || !agent || agent.id !== formData.agent_id) {
    return { success: false, error: 'Unauthorized. Invalid agent profile.' };
  }

  const { data: campusZones, error: campusZonesError } = await supabase
    .from('campus_zones')
    .select('id, name')
    .eq('campus_id', agent.campus_id)
    .order('name');

  if (campusZonesError) {
    return { success: false, error: 'Unable to load campus areas right now.' };
  }

  const normalizedArea = normalizeCampusAreaSelection(
    formData.area,
    campusZones || [],
  );
  if (!normalizedArea) {
    return {
      success: false,
      error: 'Please choose a valid hostel area for your campus.',
    };
  }

  const whatsappUpdate = await updateAgentWhatsapp(
    supabase,
    agent.id,
    formData.agent_whatsapp,
  );
  if (!whatsappUpdate.success) {
    return whatsappUpdate;
  }

  try {
    // 1. Generate unique slug
    const area = normalizedArea;
    const county = formData.county || 'nyeri';
    const baseSlug = generateListingSlug(formData.title, area);
    const slug = await uniqueSlug(baseSlug, async (s) => {
      const { data } = await supabase
        .from('listings')
        .select('id')
        .eq('slug', s)
        .maybeSingle();
      return !!data;
    });

    // 2. Insert listing
    const { data: listing, error: listingError } = await supabase
      .from('listings')
      .insert({
        ...listingPayload(formData, agent.id),
        area: normalizedArea,
        slug,
        campus_id: agent.campus_id,
      })
      .select()
      .single();

    if (listingError || !listing) {
      console.error('Listing insert error:', listingError);
      return {
        success: false,
        error: listingError?.message || 'Failed to insert listing',
      };
    }

    // 2. Insert images
    const imagesError = await replaceListingImages(
      supabase,
      listing.id,
      formData.images || [],
    );
    if (imagesError) {
      console.error('Error inserting images:', imagesError);
      return {
        success: false,
        error: 'Listing created, but failed to save some images',
      };
    }

    // 3. Insert room types
    const rtError = await replaceRoomTypes(
      supabase,
      listing.id,
      formData.roomTypes || [],
    );
    if (rtError) {
      console.error('Error inserting room types:', rtError);
      return {
        success: false,
        error: 'Listing created, but failed to save some room types',
      };
    }

    // 4. Auto-verify against DeKUT official records
    autoVerifyListing(supabase, listing.id, formData, agent.id).catch(() => {});

    revalidateListingSurfaces(county, area, slug);

    // Send push notifications to users who saved hostels in the same area
    sendPushNewListing(supabase, listing, county, area).catch(() => {});

    // Notify all admins of the new listing
    import('@/lib/push').then(({ sendPushToUsers, getAdminUserIds }) =>
      getAdminUserIds().then((adminIds) => {
        if (adminIds.length > 0) {
          sendPushToUsers(adminIds, {
            title: 'New listing created',
            body: `"${listing.title}" was just added in ${area}.`,
            url: `/admin/listings`,
            tag: 'new-listing-admin',
          }).catch(() => {});
        }
      }),
    );

    return {
      success: true,
      listingId: listing.id,
      listingUrl: `/hostels/${county}/${area}/${slug}`,
    };
  } catch (error: any) {
    console.error('Server action error:', error);
    return {
      success: false,
      error: error.message || 'An unexpected error occurred',
    };
  }
}

export async function updateListingAction(formData: any) {
  const supabase = await createClient();

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return { success: false, error: 'Unauthorized. Please log in.' };
  }

  const { data: agent, error: agentError } = await supabase
    .from('agents')
    .select('id, campus_id')
    .eq('user_id', user.id)
    .single();

  if (agentError || !agent || agent.id !== formData.agent_id) {
    return { success: false, error: 'Unauthorized. Invalid agent profile.' };
  }

  const { data: campusZones, error: campusZonesError } = await supabase
    .from('campus_zones')
    .select('id, name')
    .eq('campus_id', agent.campus_id)
    .order('name');

  if (campusZonesError) {
    return { success: false, error: 'Unable to load campus areas right now.' };
  }

  const normalizedArea = normalizeCampusAreaSelection(
    formData.area,
    campusZones || [],
  );
  if (!normalizedArea) {
    return {
      success: false,
      error: 'Please choose a valid hostel area for your campus.',
    };
  }

  if (!formData.listing_id) {
    return { success: false, error: 'Missing listing id.' };
  }

  try {
    const { data: existing, error: existingError } = await supabase
      .from('listings')
      .select('id, slug, county, area, price')
      .eq('id', formData.listing_id)
      .eq('agent_id', agent.id)
      .single();

    if (existingError || !existing) {
      return { success: false, error: 'Listing not found or unauthorized.' };
    }

    const whatsappUpdate = await updateAgentWhatsapp(
      supabase,
      agent.id,
      formData.agent_whatsapp,
    );
    if (!whatsappUpdate.success) {
      return whatsappUpdate;
    }

    const { data: listing, error: listingError } = await supabase
      .from('listings')
      .update({
        ...listingPayload(formData, agent.id),
        area: normalizedArea,
      })
      .eq('id', existing.id)
      .eq('agent_id', agent.id)
      .select('id, slug, county, area')
      .single();

    if (listingError || !listing) {
      console.error('Listing update error:', listingError);
      return {
        success: false,
        error: listingError?.message || 'Failed to update listing',
      };
    }

    const imagesError = await replaceListingImages(
      supabase,
      listing.id,
      formData.images || [],
    );
    if (imagesError) {
      console.error('Error updating images:', imagesError);
      return {
        success: false,
        error: 'Listing updated, but failed to save some images',
      };
    }

    const rtError = await replaceRoomTypes(
      supabase,
      listing.id,
      formData.roomTypes || [],
    );
    if (rtError) {
      console.error('Error updating room types:', rtError);
      return {
        success: false,
        error: 'Listing updated, but failed to save some room types',
      };
    }

    revalidateListingSurfaces(
      listing.county || existing.county || 'nyeri',
      listing.area || existing.area || 'dekut',
      listing.slug || existing.slug,
    );

    // Auto-verify on update (in case landlord_phone changed)
    autoVerifyListing(supabase, listing.id, formData, agent.id).catch(() => {});

    // Send price drop notifications to users who saved this listing
    const newPrice =
      parseFloat(formData.price_single || formData.price) || null;
    if (existing.price && newPrice && newPrice < existing.price) {
      sendPushPriceDrop(
        supabase,
        existing.id,
        formData.title || listing.slug,
        existing.price,
        newPrice,
      ).catch(() => {});
    }

    return {
      success: true,
      listingId: listing.id,
      listingUrl: `/hostels/${listing.county || 'nyeri'}/${listing.area || 'dekut'}/${listing.slug}`,
    };
  } catch (error: any) {
    console.error('Server action error:', error);
    return {
      success: false,
      error: error.message || 'An unexpected error occurred',
    };
  }
}

// --- Push notification helpers (fire-and-forget, never block the action) ---

async function sendPushNewListing(
  supabase: any,
  listing: { id: string; title: string },
  county: string,
  area: string,
) {
  // Find users who saved hostels in the same area
  const { data: areaUsers } = await supabase
    .from('saved_hostels')
    .select('user_id, listings!inner(area)')
    .eq('listings.area', area)
    .not('user_id', 'is', null);

  if (!areaUsers || areaUsers.length === 0) return;

  const userIds = Array.from(
    new Set<string>(areaUsers.map((r: any) => r.user_id as string)),
  );

  await sendPushToUsers(userIds, {
    title: 'New hostel available',
    body: `A new listing just dropped in ${area}: "${listing.title}"`,
    url: `/hostels/${county}/${area}`,
    tag: 'new-listing',
  });
}

async function sendPushPriceDrop(
  supabase: any,
  listingId: string,
  title: string,
  oldPrice: number,
  newPrice: number,
) {
  // Find users who saved this specific listing
  const { data: saved } = await supabase
    .from('saved_hostels')
    .select('user_id')
    .eq('listing_id', listingId);

  if (!saved || saved.length === 0) return;

  const userIds = Array.from(
    new Set<string>(saved.map((r: any) => r.user_id as string)),
  );
  const savings = oldPrice - newPrice;

  await sendPushToUsers(userIds, {
    title: 'Price drop!',
    body: `"${title}" dropped by KSh ${savings.toLocaleString()} — now KSh ${newPrice.toLocaleString()}/mo`,
    url: `/listing/${listingId}`,
    tag: `price-drop-${listingId}`,
  });
}

async function autoVerifyListing(
  supabase: any,
  listingId: string,
  formData: any,
  agentId: string,
) {
  try {
    const { data: agent } = await supabase
      .from('agents')
      .select('phone, whatsapp')
      .eq('id', agentId)
      .single();

    const result = verifyListingAgainstOfficial(
      {
        id: listingId,
        title: formData.title || '',
        landlord_phone: formData.landlord_phone || null,
        agent_phone: agent?.phone ?? null,
        agent_whatsapp: agent?.whatsapp ?? null,
      },
      OFFICIAL_RECORDS,
      OFFICIAL_PHONE_INDEX,
    );

    if (
      result.verified ||
      result.manual_review_needed ||
      result.shared_contact_detected
    ) {
      const updatePayload: Record<string, unknown> = {};
      if (result.verified) {
        updatePayload.verified = true;
        updatePayload.verified_source = result.verified_source;
        updatePayload.verified_date = result.verified_date;
      }
      if (result.matched_hostel) {
        updatePayload.discrepancy_review_needed =
          result.discrepancy_review_needed;
        updatePayload.shared_contact_detected = result.shared_contact_detected;
        updatePayload.manual_review_needed = result.manual_review_needed;
      }

      if (Object.keys(updatePayload).length > 0) {
        await supabase
          .from('listings')
          .update(updatePayload)
          .eq('id', listingId);
      }
    }
  } catch (err) {
    console.error('Auto-verification failed for listing:', listingId, err);
  }
}

/**
 * Agent toggles is_active on their own listing.
 * Revalidates public paths so the change is immediately reflected.
 */
export async function toggleListingActiveAction(
  listingId: string,
): Promise<{ success: boolean; error?: string; isActive?: boolean }> {
  const supabase = await createClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return { success: false, error: 'Unauthorized. Please log in.' };
  }

  const { data: agent, error: agentError } = await supabase
    .from('agents')
    .select('id')
    .eq('user_id', user.id)
    .single();

  if (agentError || !agent) {
    return { success: false, error: 'Agent profile not found.' };
  }

  const { data: listing, error: fetchError } = await supabase
    .from('listings')
    .select('id, is_active, slug, county, area')
    .eq('id', listingId)
    .eq('agent_id', agent.id)
    .single();

  if (fetchError || !listing) {
    return { success: false, error: 'Listing not found or unauthorized.' };
  }

  const newStatus = !listing.is_active;
  const { error: updateError } = await supabase
    .from('listings')
    .update({ is_active: newStatus })
    .eq('id', listing.id);

  if (updateError) {
    return { success: false, error: updateError.message };
  }

  revalidatePath('/dashboard');
  revalidatePath('/dashboard/listings');
  revalidatePath('/hostels');
  revalidatePath('/');
  const county = listing.county || 'nyeri';
  const area = listing.area || 'dekut';
  revalidatePath(`/hostels/${county}/${area}`);
  if (listing.slug) {
    revalidatePath(`/hostels/${county}/${area}/${listing.slug}`);
    revalidatePath(`/listing/${listing.id}`);
  }

  return { success: true, isActive: newStatus };
}

/**
 * Agent toggles is_full (currently occupied) on their own listing.
 * When is_full is true, the hostel owner contact is hidden from public
 * and visitors are directed to the agent for recommendations.
 */
export async function toggleListingFullAction(
  listingId: string,
): Promise<{ success: boolean; error?: string; isFull?: boolean }> {
  const supabase = await createClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return { success: false, error: 'Unauthorized. Please log in.' };
  }

  const { data: agent, error: agentError } = await supabase
    .from('agents')
    .select('id')
    .eq('user_id', user.id)
    .single();

  if (agentError || !agent) {
    return { success: false, error: 'Agent profile not found.' };
  }

  const { data: listing, error: fetchError } = await supabase
    .from('listings')
    .select('id, is_full, slug, county, area')
    .eq('id', listingId)
    .eq('agent_id', agent.id)
    .single();

  if (fetchError || !listing) {
    return { success: false, error: 'Listing not found or unauthorized.' };
  }

  const newFull = !(listing as any).is_full;
  const { error: updateError } = await supabase
    .from('listings')
    .update({ is_full: newFull } as any)
    .eq('id', listing.id);

  if (updateError) {
    return { success: false, error: updateError.message };
  }

  revalidatePath('/dashboard');
  revalidatePath('/dashboard/listings');
  revalidatePath('/hostels');
  revalidatePath('/');
  const county = listing.county || 'nyeri';
  const area = listing.area || 'dekut';
  revalidatePath(`/hostels/${county}/${area}`);
  if (listing.slug) {
    revalidatePath(`/hostels/${county}/${area}/${listing.slug}`);
    revalidatePath(`/listing/${listing.id}`);
  }

  return { success: true, isFull: newFull };
}

/**
 * Agent toggles pays_commission on their own listing (unless admin-locked).
 * Revalidates the shared public surfaces so pricing/consultation changes apply.
 */
export async function toggleListingCommissionAction(
  listingId: string,
): Promise<{ success: boolean; error?: string; paysCommission?: boolean }> {
  const supabase = await createClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return { success: false, error: 'Unauthorized. Please log in.' };
  }

  const { data: agent, error: agentError } = await supabase
    .from('agents')
    .select('id')
    .eq('user_id', user.id)
    .single();

  if (agentError || !agent) {
    return { success: false, error: 'Agent profile not found.' };
  }

  const { data: listing, error: fetchError } = await supabase
    .from('listings')
    .select('id, pays_commission, commission_locked_by_admin, slug, county, area')
    .eq('id', listingId)
    .eq('agent_id', agent.id)
    .single();

  if (fetchError || !listing) {
    return { success: false, error: 'Listing not found or unauthorized.' };
  }

  if (listing.commission_locked_by_admin) {
    return { success: false, error: 'Commission setting is locked by an admin.' };
  }

  const newPaysCommission = !listing.pays_commission;
  const { error: updateError } = await supabase
    .from('listings')
    .update({ pays_commission: newPaysCommission })
    .eq('id', listing.id);

  if (updateError) {
    return { success: false, error: updateError.message };
  }

  revalidatePath('/dashboard');
  revalidatePath('/dashboard/listings');
  revalidatePath('/hostels');
  revalidatePath('/');
  const county = listing.county || 'nyeri';
  const area = listing.area || 'dekut';
  revalidatePath(`/hostels/${county}/${area}`);
  if (listing.slug) {
    revalidatePath(`/hostels/${county}/${area}/${listing.slug}`);
    revalidatePath(`/listing/${listing.id}`);
  }

  return { success: true, paysCommission: newPaysCommission };
}

/**
 * Fetches the full hostels directory for the agent dashboard: all official
 * DeKUT housing records plus every agent-uploaded listing with its
 * availability (is_full) status. Read-only, no scoping needed.
 */
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
