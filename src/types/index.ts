// Standard Types for Rumia Marketplace

export interface Agent {
  id: string | number;
  name: string;
  phone: string;
  whatsapp: string;
  commission_balance: number;
}

export interface Listing {
  id: string | number;
  title: string;
  description: string;
  price: number;
  location: string;
  youtube_id?: string | null;
  agent_id: string | number;
  is_active: boolean;
  // New hostel detail fields
  area?: string | null;
  specific_location?: string | null;
  price_single?: number | null;
  price_sharing?: number | null;
  mpesa_details?: string | null;
  distance_category?: string | null;
  gender?: 'mixed' | 'male' | 'female' | null;
  latitude?: number | null;
  longitude?: number | null;
  bathroom_type?: string | null;
  amenities?: string[] | null;
  room_type?: string | null;
}

export interface ListingImage {
  id: string | number;
  listing_id: string | number;
  r2_url: string;
  display_order: number;
  category?: string | null;
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
