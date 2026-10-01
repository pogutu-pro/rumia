// Shared shapes for the in-memory listing search (see client-search.ts).

export interface SearchListing {
  id: string;
  title: string;
  description: string;
  price: number;
  location: string;
  slug: string | null;
  county: string | null;
  area: string | null;
  gender?: 'mixed' | 'male' | 'female' | null;
  specific_location?: string | null;
  price_single?: number | null;
  price_sharing?: number | null;
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
  hot_water_included?: boolean | null;
  cooking_gas_included?: boolean | null;
  security_type?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  proximity_description?: string | null;
  created_at?: string;
  sort_position?: number | null;
  is_full?: boolean | null;
  property_type?: 'hostel' | 'apartment' | 'short_stay' | null;
  listing_images: {
    r2_url: string;
    display_order: number;
    blur_data_url?: string;
  }[];
  agents: { name: string; phone?: string; whatsapp?: string } | null;
  listing_room_types?: {
    deposit?: number | null;
    furnishing_items?: string[] | null;
    room_type?: string | null;
  }[] | null;
}

export interface CombinedFilters {
  searchText: string;
  genders: string[];
  amenities: string[];
  roomTypes: string[];
  minPrice: number | null;
  maxPrice: number | null;
  zones: string[];
}
