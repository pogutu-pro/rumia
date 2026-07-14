// Standard Types for Rumia Marketplace

export interface Agent {
  id: string | number;
  name: string;
  phone: string;
  whatsapp: string;
  commission_balance: number;
  // Profile fields
  profile_photo_url?: string | null;
  cover_image_url?: string | null;
  bio?: string | null;
  service_areas?: string[] | null;
  languages?: string[] | null;
  helping_since?: number | null;
  instagram?: string | null;
  linkedin?: string | null;
  instagram_public?: boolean | null;
  linkedin_public?: boolean | null;
  verified?: boolean | null;
  portfolio_url?: string | null;
  is_featured?: boolean | null;
  is_founder?: boolean | null;
  status?: 'active' | 'suspended';
  slug?: string | null;
  user_id?: string | null;
  created_at?: string;
  updated_at?: string;
}

export interface Listing {
  id: string | number;
  title: string;
  description: string;
  price: number;
  location: string;
  youtube_id?: string | null;
  is_youtube_shorts?: boolean;
  agent_id: string | number;
  is_active: boolean;
  created_at?: string;
  // Location & area
  area?: string | null;
  specific_location?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  // Pricing
  price_single?: number | null;
  price_sharing?: number | null;
  mpesa_details?: string | null;
  // Amenities & features (structured)
  amenities?: string[] | null;
  room_type?: string | null;
  room_type_enum?: string | null;
  bathroom_type?: string | null;
  distance_category?: string | null;
  distance_to_campus?: string | null;
  gender?: 'mixed' | 'male' | 'female' | null;
  // Utilities
  wifi_included?: boolean | null;
  water_included?: boolean | null;
  electricity_included?: boolean | null;
  security_type?: string | null;
  // Contact
  landlord_phone?: string | null;
  // SEO
  slug?: string | null;
  county?: string | null;
  // Search
  proximity_description?: string | null;
}

export interface ListingImage {
  id: string | number;
  listing_id: string | number;
  r2_url: string;
  display_order: number;
  category?: string | null;
  blur_data_url?: string | null;
  width?: number | null;
  height?: number | null;
  format?: string | null;
  image_upload_id?: string | null;
}

export interface Lead {
  id: string | number;
  listing_id: string | number;
  agent_id: string | number;
  clicked_at: string;
  ip_hash: string;
}

export interface Commission {
  id: string | number;
  agent_id: string | number;
  listing_id: string | number;
  amount: number;
  status: 'pending' | 'paid';
}

// Admin-specific interfaces

// Extended Agent with admin-specific fields
export interface AdminAgent {
  id: string;
  name: string;
  phone: string;
  whatsapp: string;
  status: 'active' | 'suspended';
  created_at: string;
  user_id: string;
  is_featured?: boolean | null;
  is_founder?: boolean | null;
  // Computed fields (from joins/aggregations)
  active_listings_count?: number;
  total_leads_count?: number;
  pending_commissions_sum?: number;
  role?: 'student' | 'agent' | 'admin';
}

// Extended Commission with timestamps
export interface AdminCommission {
  id: string;
  agent_id: string;
  listing_id: string;
  amount: number;
  status: 'pending' | 'paid';
  created_at: string;
  paid_at: string | null;
  // Join fields
  agents?: { name: string; id: string } | null;
  listings?: { title: string; id: string } | null;
}

// Extended Lead with join fields
export interface AdminLead {
  id: string;
  listing_id: string;
  agent_id: string;
  clicked_at: string;
  ip_hash: string;
  listings?: { title: string; id: string } | null;
  agents?: { name: string; id: string } | null;
}

export interface TransferHistory {
  id: string;
  listing_id: string;
  previous_owner_id: string;
  new_owner_id: string;
  transferred_by: string;
  transferred_at: string;
  // Join fields
  previous_owner?: { name: string } | null;
  new_owner?: { name: string } | null;
  listing?: { title: string } | null;
}

export interface CreateAgentInput {
  name: string;
  phone: string;
  whatsapp: string;
}

export interface CreateCommissionInput {
  agent_id: string;
  listing_id: string;
  amount: number;
}
