/**
 * Maps the listing form's data to the FastAPI listing payload. Shared by the agent, manager and
 * admin actions so every role submits listings the same way.
 */

function nullableCoordinate(value: unknown) {
  if (value === null || value === undefined || value === '') return null;
  const parsed = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

export function listingPayload(formData: any, agentId?: string) {
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

export function generateRoomTypeLabel(
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


/** Form images -> API image payload (position becomes display_order). */
export function mapListingImages(images: any[] | undefined | null) {
  return (images || []).map((img: any, idx: number) => ({
    r2_url: img.url || img.r2_url,
    display_order: idx,
    category: img.category || 'Room',
    blur_data_url: img.blurDataUrl || img.blur_data_url || null,
    width: img.width || null,
    height: img.height || null,
    format: img.format || null,
    image_upload_id: img.imageUploadId || img.image_upload_id || null,
  }));
}

/** Form room types -> API room-type payload (rows without a type/price are dropped). */
export function mapRoomTypes(roomTypes: any[] | undefined | null) {
  return (roomTypes || [])
    .filter((rt: any) => (rt.room_type || rt.category) && rt.price)
    .map((rt: any) => {
      const hasStructuredFields = !!(rt.category || rt.occupancy || rt.floor || rt.size);
      const label = hasStructuredFields
        ? generateRoomTypeLabel(rt.category, rt.occupancy, rt.floor, rt.size) || rt.room_type
        : rt.room_type;

      return {
        room_type: label,
        price: Math.round(parseFloat(rt.price)),
        is_available: rt.is_available ?? true,
        deposit: rt.deposit && parseInt(rt.deposit) > 0 ? parseInt(rt.deposit) : null,
        furnishing_items: rt.furnishing_items?.length ? rt.furnishing_items : [],
        category: rt.category || null,
        occupancy: rt.occupancy != null ? String(rt.occupancy) : null,
        floor: rt.floor || null,
        size: rt.size || null,
      };
    });
}
