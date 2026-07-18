'use server';

import { createClient } from '@/lib/supabase/server';
import { revalidatePath } from 'next/cache';
import { generateListingSlug, uniqueSlug } from '@/lib/utils/string';

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
    price: parseFloat(formData.price_single || formData.price) || null,
    location: formData.location,
    agent_id: agentId,
    youtube_id: formData.youtube_id || null,
    is_youtube_shorts: !!formData.is_youtube_shorts,
    is_active: formData.is_active,
    landlord_phone: null,
    room_type: formData.room_type,
    amenities: formData.amenities,
    bathroom_type: formData.bathroom_type,
    distance_to_campus: formData.distance_to_campus,
    security_type: formData.security_type,
    electricity_included: formData.electricity_included,
    water_included: formData.water_included,
    wifi_included: formData.wifi_included,
    latitude: nullableCoordinate(formData.latitude),
    longitude: nullableCoordinate(formData.longitude),
    gender: formData.gender || 'mixed',
    proximity_description: formData.proximity_description || '',
    // New hostel detail fields
    specific_location: formData.specific_location || null,
    price_single: formData.price_single && parseInt(formData.price_single) > 0
      ? parseInt(formData.price_single)
      : null,
    price_sharing: formData.price_sharing && parseInt(formData.price_sharing) > 0
      ? parseInt(formData.price_sharing)
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
  occupancy?: string,
  floor?: string,
  size?: string,
): string {
  if (!category) return '';

  const categoryMap: Record<string, string> = {
    bedsitter: 'Bedsitter',
    single_room: 'Single Room',
    double_room: 'Double Room',
    studio: 'Studio',
  };

  const occupancyMap: Record<string, string> = {
    alone: 'Alone',
    sharing_2: 'Sharing',
    sharing_3: 'Sharing',
  };

  let label = categoryMap[category] || category;

  const parts: string[] = [];
  if (floor && floor !== 'na') {
    parts.push(floor === 'ground' ? 'Ground floor' : 'Upper floor');
  }
  if (size && size !== 'standard') {
    parts.push(size === 'smaller' ? 'Smaller' : 'Larger');
  }
  if (occupancy) {
    parts.push(occupancyMap[occupancy] || occupancy);
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
      const hasStructuredFields = !!(rt.category || rt.occupancy || rt.floor || rt.size);
      const label = hasStructuredFields
        ? generateRoomTypeLabel(rt.category, rt.occupancy, rt.floor, rt.size) || rt.room_type
        : rt.room_type;

      return {
        listing_id: listingId,
        room_type: label,
        price: Math.round(parseFloat(rt.price)),
        is_available: rt.is_available,
        deposit: rt.deposit && parseInt(rt.deposit) > 0 ? parseInt(rt.deposit) : null,
        furnishing_items: rt.furnishing_items?.length ? rt.furnishing_items : null,
        category: rt.category || null,
        occupancy: rt.occupancy || null,
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
  revalidatePath('/');
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
    .select('id')
    .eq('user_id', user.id)
    .single();

  if (agentError || !agent || agent.id !== formData.agent_id) {
    return { success: false, error: 'Unauthorized. Invalid agent profile.' };
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
    const area = formData.area || 'dekut';
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
        slug,
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

    revalidateListingSurfaces(county, area, slug);

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
    .select('id')
    .eq('user_id', user.id)
    .single();

  if (agentError || !agent || agent.id !== formData.agent_id) {
    return { success: false, error: 'Unauthorized. Invalid agent profile.' };
  }

  if (!formData.listing_id) {
    return { success: false, error: 'Missing listing id.' };
  }

  try {
    const { data: existing, error: existingError } = await supabase
      .from('listings')
      .select('id, slug, county, area')
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
      .update(listingPayload(formData, agent.id))
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
