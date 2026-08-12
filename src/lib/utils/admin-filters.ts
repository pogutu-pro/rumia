/**
 * Pure filter functions for the Rumia Admin Panel tables.
 * All functions are side-effect-free and operate on plain arrays.
 */

export interface ListingFilterOptions {
  agentId?: string;
  status?: 'active' | 'inactive' | 'all';
  location?: string;
}

export interface LeadFilterOptions {
  agentId?: string;
  listingId?: string;
  startDate?: string;
  endDate?: string;
}

export interface CommissionFilterOptions {
  agentId?: string;
  status?: 'pending' | 'paid' | 'all';
  startDate?: string;
  endDate?: string;
}

/**
 * Filters a listings array by the given criteria (AND semantics).
 * - `agentId`: exact match on the listing's `agent_id` field (as string)
 * - `status`: 'active' → `is_active === true`, 'inactive' → `is_active === false`, 'all' → no filter
 * - `location`: case-insensitive substring match on the listing's `location` field
 * Validates: Requirements 9.3, 9.4
 */
export function filterListings<T extends { agent_id?: string | number | null; is_active: boolean; location: string }>(
  listings: T[],
  filters: ListingFilterOptions,
): T[] {
  return listings.filter((listing) => {
    if (filters.agentId) {
      if (String(listing.agent_id) !== filters.agentId) return false;
    }

    if (filters.status && filters.status !== 'all') {
      const shouldBeActive = filters.status === 'active';
      if (listing.is_active !== shouldBeActive) return false;
    }

    if (filters.location) {
      if (!listing.location.toLowerCase().includes(filters.location.toLowerCase())) {
        return false;
      }
    }

    return true;
  });
}

/**
 * Filters a leads array by the given criteria (AND semantics).
 * - `agentId`: exact match on the lead's `agent_id` field (as string)
 * - `listingId`: exact match on the lead's `listing_id` field (as string)
 * - `startDate`: ISO date string — includes only leads where `clicked_at >= startDate`
 * - `endDate`: ISO date string — includes only leads where `clicked_at <= endDate`
 * Validates: Requirements 10.5, 10.6
 */
export function filterLeads<T extends { agent_id?: string | number | null; listing_id?: string | number | null; clicked_at: string }>(
  leads: T[],
  filters: LeadFilterOptions,
): T[] {
  return leads.filter((lead) => {
    if (filters.agentId) {
      if (String(lead.agent_id) !== filters.agentId) return false;
    }

    if (filters.listingId) {
      if (String(lead.listing_id) !== filters.listingId) return false;
    }

    if (filters.startDate) {
      if (lead.clicked_at < filters.startDate) return false;
    }

    if (filters.endDate) {
      if (lead.clicked_at > filters.endDate) return false;
    }

    return true;
  });
}

/**
 * Filters a commissions array by the given criteria (AND semantics).
 * - `agentId`: exact match on the commission's `agent_id` field (as string)
 * - `status`: 'pending' or 'paid' for exact status match; 'all' → no filter
 * - `startDate`: ISO date string — includes only commissions where `created_at >= startDate`
 * - `endDate`: ISO date string — includes only commissions where `created_at <= endDate`
 * Validates: Requirements 11.5, 11.6
 */
export function filterCommissions<T extends { agent_id?: string | number | null; status: string; created_at: string }>(
  commissions: T[],
  filters: CommissionFilterOptions,
): T[] {
  return commissions.filter((commission) => {
    if (filters.agentId) {
      if (String(commission.agent_id) !== filters.agentId) return false;
    }

    if (filters.status && filters.status !== 'all') {
      if (commission.status !== filters.status) return false;
    }

    if (filters.startDate) {
      if (commission.created_at < filters.startDate) return false;
    }

    if (filters.endDate) {
      if (commission.created_at > filters.endDate) return false;
    }

    return true;
  });
}
