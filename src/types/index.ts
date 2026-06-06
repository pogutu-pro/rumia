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
}

export interface ListingImage {
  id: string | number;
  listing_id: string | number;
  r2_url: string;
  display_order: number;
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
