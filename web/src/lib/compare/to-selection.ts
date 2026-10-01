import type { CompareSelection } from '@/stores/compare-store';

/** The subset of the API listing the comparison view needs (GET /listings). */
export interface CompareListingSource {
  id: string;
  title: string;
  price: number;
  price_single?: number | null;
  price_sharing?: number | null;
  slug?: string | null;
  county?: string | null;
  area?: string | null;
  gender?: string | null;
  specific_location?: string | null;
  distance_category?: string | null;
  distance_to_campus?: string | null;
  mpesa_details?: string | null;
  amenities?: string[] | null;
  room_type?: string | null;
  room_type_enum?: string | null;
  bathroom_type?: string | null;
  wifi_included?: boolean | null;
  water_included?: boolean | null;
  electricity_included?: boolean | null;
  security_type?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  images?: { r2_url: string; display_order: number }[] | null;
  room_types?: {
    deposit?: number | null;
    furnishing_items?: string[] | null;
    room_type?: string | null;
  }[] | null;
  agent?: { name: string; phone?: string | null; whatsapp?: string | null } | null;
}

/** Map an API listing to the compare-store shape (single source of truth). */
export function listingToCompareSelection(
  item: CompareListingSource,
  fallbackImageUrl?: string,
): CompareSelection {
  const sorted = [...(item.images ?? [])].sort((a, b) => a.display_order - b.display_order);
  const firstRoom = item.room_types?.[0];
  return {
    id: item.id,
    title: item.title,
    price: item.price,
    price_single: item.price_single,
    price_sharing: item.price_sharing,
    imageUrl: sorted[0]?.r2_url ?? fallbackImageUrl,
    slug: item.slug,
    county: item.county,
    area: item.area,
    agentName: item.agent?.name ?? null,
    agentPhone: item.agent?.phone ?? null,
    agentWhatsapp: item.agent?.whatsapp ?? null,
    amenities: item.amenities,
    roomType: item.room_type,
    roomTypeEnum: item.room_type_enum,
    bathroomType: item.bathroom_type,
    distanceCategory: item.distance_category,
    distanceToCampus: item.distance_to_campus,
    gender: item.gender,
    wifiIncluded: item.wifi_included,
    waterIncluded: item.water_included,
    electricityIncluded: item.electricity_included,
    securityType: item.security_type,
    specificLocation: item.specific_location,
    latitude: item.latitude,
    longitude: item.longitude,
    mpesaDetails: item.mpesa_details,
    deposit: firstRoom?.deposit ?? null,
    furnishingItems: firstRoom?.furnishing_items ?? null,
    roomTypeLabel: firstRoom?.room_type ?? null,
  };
}
