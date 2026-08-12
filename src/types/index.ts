// Standard Types for Rumia Marketplace

export interface Agent {
  id: string | number;
  name: string;
  phone: string;
  whatsapp: string;
  commission_balance: number;
  // Pochi la Biashara payment details (optional)
  pochi_la_biashara_number: string | null;
  expected_name: string | null;
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
  campus_id?: string | null;
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
  pays_commission?: boolean;
  commission_locked_by_admin?: boolean;
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
  // Campus scoping
  campus_id?: string | null;
  // SEO
  slug?: string | null;
  county?: string | null;
  // Search
  proximity_description?: string | null;
  // Admin ordering
  sort_position?: number | null;
  // DeKUT verification
  verified?: boolean | null;
  verified_source?: string | null;
  verified_date?: string | null;
  discrepancy_review_needed?: boolean | null;
  official_record_no_listing?: boolean | null;
  shared_contact_detected?: boolean | null;
  manual_review_needed?: boolean | null;
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
  contact_type?: 'hostel_owner' | 'rumia_agent' | null;
  name?: string | null;
  phone?: string | null;
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
  // Pochi la Biashara payment details (optional)
  pochi_la_biashara_number: string | null;
  expected_name: string | null;
  status: 'active' | 'suspended';
  created_at: string;
  user_id: string;
  is_featured?: boolean | null;
  is_founder?: boolean | null;
  campus_id?: string | null;
  // Computed fields (from joins/aggregations)
  active_listings_count?: number;
  total_leads_count?: number;
  pending_commissions_sum?: number;
  role?: UserRole;
}

// ── Profile (users) with campus scoping ─────────────────────────────────

export interface Profile {
  id: string;
  email?: string | null;
  full_name?: string | null;
  avatar_url?: string | null;
  phone?: string | null;
  role?: UserRole;
  campus_id?: string | null;
  home_campus_id?: string | null;
  home_campus_name?: string | null;
  managed_campus_id?: string | null;
  created_at?: string;
  updated_at?: string;
  // Computed join fields
  has_agent?: boolean;
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
  contact_type?: 'hostel_owner' | 'rumia_agent' | null;
  name?: string | null;
  phone?: string | null;
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

export interface ListingSortHistory {
  id: string;
  listing_id: string;
  admin_id: string;
  old_position: number | null;
  new_position: number | null;
  changed_at: string;
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

// ── Tour Bookings ───────────────────────────────────────────

// ── Roles ────────────────────────────────────────────────────────────

export type UserRole = 'student' | 'agent' | 'manager' | 'admin';

// ── Campuses ────────────────────────────────────────────────────────────

export interface Campus {
  id: string;
  slug: string;
  name: string;
  city: string;
  hero_headline: string;
  hero_subtext: string | null;
  whatsapp_number: string;
  primary_color: string;
  feature_flags: Record<string, unknown>;
  seo_title: string | null;
  seo_description: string | null;
  seo_keywords: string[];
  og_title: string | null;
  og_description: string | null;
  twitter_description: string | null;
  manifest_name: string | null;
  manifest_description: string | null;
  short_name: string | null;
  hero_image: string | null;
  hostel_finding_fee?: number | null;
  status: 'active' | 'coming_soon' | 'suspended';
  created_at: string;
}

// ── Agent Applications ──────────────────────────────────────────────────

export type AgentApplicationStatus = 'pending' | 'approved' | 'rejected';

export interface AgentApplication {
  id: string;
  user_id: string;
  campus_id: string;
  full_name: string;
  phone: string;
  id_number: string;
  hostel_name: string;
  relationship_to_hostel: string;
  owner_contact: string | null;
  status: AgentApplicationStatus;
  reviewed_by: string | null;
  reviewed_at: string | null;
  rejection_reason: string | null;
  created_at: string;
}

export interface CreateAgentApplicationInput {
  campus_id: string;
  full_name: string;
  phone: string;
  id_number: string;
  hostel_name: string;
  relationship_to_hostel: string;
  owner_contact?: string | null;
}

export type TourType = 'specific_hostel' | 'full_search';
export type TourTimeWindow = 'morning' | 'afternoon' | 'evening';
export type TourStatus =
  | 'pending_payment'
  | 'confirmed'
  | 'paid'
  | 'completed'
  | 'no_show'
  | 'cancelled';

export interface TourBooking {
  id: string;
  student_name: string;
  phone: string;
  listing_id: string | null;
  zone: string;
  tour_type: TourType;
  amount: number;
  preferred_date: string;
  preferred_time: TourTimeWindow;
  status: TourStatus;
  linked_user_id: string | null;
  agent_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface TourBookingWithJoins extends TourBooking {
  listings?: { id: string; title: string; area: string | null } | null;
  agents?: { id: string; name: string } | null;
}

export interface CreateTourBookingInput {
  student_name: string;
  phone: string;
  listing_id?: string | null;
  zone: string;
  tour_type: TourType;
  amount: number;
  preferred_date: string;
  preferred_time: TourTimeWindow;
  agent_id?: string | null;
}

// ── DeKUT Verification ─────────────────────────────────────

export interface DeKutOfficialHostel {
  id: string;
  hostel_name: string;
  zone: string;
  contacts: string;
  payments: string;
  source: string;
  verified_date: string;
  created_at: string;
}

export interface ListingVerification {
  id: string;
  listing_id: string;
  official_hostel_id: string | null;
  match_type: 'phone' | 'name' | 'manual' | 'none';
  match_confidence: number | null;
  verified: boolean;
  verified_source: string | null;
  verified_date: string | null;
  flags: string[];
  reviewed_by: string | null;
  reviewed_at: string | null;
  created_at: string;
}

// ── Hostel Requests (Find Me a Hostel) ────────────────────────────────

export type HostelRequestStatus =
  | 'waiting'
  | 'contacted'
  | 'finding'
  | 'hostel_found'
  | 'completed'
  | 'cancelled';

export type HostelRequestGender = 'male' | 'female' | 'no_preference';
export type HostelRequestRoomType =
  | 'single'
  | 'shared'
  | 'bedsitter'
  | 'no_preference';
export type HostelRequestFurnishing =
  | 'furnished'
  | 'unfurnished'
  | 'no_preference';

export interface HostelRequest {
  id: string;
  user_id: string;
  student_name: string;
  phone: string;
  campus_id: string;
  preferred_zone: string | null;
  budget_range: string;
  gender: HostelRequestGender;
  room_type: HostelRequestRoomType;
  furnishing: HostelRequestFurnishing;
  move_in_date: string | null;
  additional_requirements: string | null;
  status: HostelRequestStatus;
  fee: number;
  created_at: string;
  updated_at: string;
}

export interface HostelRequestWithCampus extends HostelRequest {
  campuses?: { id: string; name: string; slug: string } | null;
}

export interface CreateHostelRequestInput {
  phone: string;
  preferred_zone?: string | null;
  budget_range: string;
  gender: HostelRequestGender;
  room_type: HostelRequestRoomType;
  furnishing: HostelRequestFurnishing;
  move_in_date?: string | null;
  additional_requirements?: string | null;
}

export interface AppNotification {
  id: string;
  user_id: string;
  title: string;
  body: string;
  url: string | null;
  is_read: boolean;
  created_at: string;
}

// ── Announcements ───────────────────────────────────────────────────────

export type AnnouncementType = 'info' | 'warning' | 'encouragement';

export interface Announcement {
  id: string;
  campus_id: string;
  title: string;
  message: string;
  type: AnnouncementType;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  expires_at: string;
}

/** Columns selected for the public announcement section (kept minimal). */
export interface PublicAnnouncement {
  id: string;
  title: string;
  message: string;
  type: AnnouncementType;
}

export interface VerificationRunResult {
  listing_id: string;
  listing_title: string;
  verified: boolean;
  verified_source: string | null;
  verified_date: string | null;
  match_type: 'phone' | 'name' | 'manual' | 'none';
  match_confidence: number | null;
  matched_hostel: string | null;
  flags: string[];
  discrepancy_review_needed: boolean;
  shared_contact_detected: boolean;
  manual_review_needed: boolean;
  official_record_no_listing: boolean;
}
