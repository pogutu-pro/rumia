'use server';

import { createClient } from '@/lib/supabase/server';
import { revalidatePath } from 'next/cache';

export async function createListingAction(formData: any) {
  const supabase = await createClient();

  // Verify authentication securely on the server
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  
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

  try {
    // 1. Insert listing
    const { data: listing, error: listingError } = await supabase
      .from('listings')
      .insert({
        title: formData.title,
        description: formData.description,
        price: parseFloat(formData.price),
        location: formData.location,
        agent_id: agent.id,
        youtube_id: formData.youtube_id || null,
        is_active: formData.is_active,
        landlord_phone: formData.landlord_phone,
        room_type: formData.room_type,
        amenities: formData.amenities,
        bathroom_type: formData.bathroom_type,
        distance_to_campus: formData.distance_to_campus,
        security_type: formData.security_type,
        electricity_included: formData.electricity_included,
        water_included: formData.water_included,
        wifi_included: formData.wifi_included,
        latitude: parseFloat(formData.latitude) || -0.3975,
        longitude: parseFloat(formData.longitude) || 36.9615,
      })
      .select()
      .single();

    if (listingError || !listing) {
      console.error('Listing insert error:', listingError);
      return { success: false, error: listingError?.message || 'Failed to insert listing' };
    }

    // 2. Insert images
    if (formData.images && formData.images.length > 0) {
      const imageInserts = formData.images.map((img: any, idx: number) => ({
        listing_id: listing.id,
        r2_url: img.url,
        display_order: idx,
        category: img.category || 'Room',
      }));

      const { error: imagesError } = await supabase
        .from('listing_images')
        .insert(imageInserts);

      if (imagesError) {
        console.error('Error inserting images:', imagesError);
        return { success: false, error: 'Listing created, but failed to save some images' };
      }
    }

    // 3. Insert room types
    if (formData.roomTypes && formData.roomTypes.length > 0) {
      const validRoomTypes = formData.roomTypes
        .filter((rt: any) => rt.room_type && rt.price)
        .map((rt: any) => ({
          listing_id: listing.id,
          room_type: rt.room_type,
          price: parseFloat(rt.price),
          is_available: rt.is_available,
        }));

      if (validRoomTypes.length > 0) {
        const { error: rtError } = await supabase
          .from('listing_room_types')
          .insert(validRoomTypes);

        if (rtError) {
          console.error('Error inserting room types:', rtError);
          return { success: false, error: 'Listing created, but failed to save some room types' };
        }
      }
    }

    revalidatePath('/');
    revalidatePath('/browse');
    revalidatePath('/dashboard');
    
    return { success: true, listingId: listing.id };
  } catch (error: any) {
    console.error('Server action error:', error);
    return { success: false, error: error.message || 'An unexpected error occurred' };
  }
}
