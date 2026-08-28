import { filterListings, filterLeads, filterCommissions } from '../admin-filters';

// ── Shared test data ───────────────────────────────────────────────────────

const listings = [
  { id: '1', agent_id: 'a1', is_active: true, location: 'Nairobi CBD', title: 'Listing 1' },
  { id: '2', agent_id: 'a1', is_active: false, location: 'Westlands', title: 'Listing 2' },
  { id: '3', agent_id: 'a2', is_active: true, location: 'Nairobi South', title: 'Listing 3' },
  { id: '4', agent_id: 'a2', is_active: false, location: 'Mombasa Road', title: 'Listing 4' },
];

const leads = [
  { id: '1', agent_id: 'a1', listing_id: 'l1', clicked_at: '2024-01-10T08:00:00.000Z' },
  { id: '2', agent_id: 'a1', listing_id: 'l2', clicked_at: '2024-01-20T10:00:00.000Z' },
  { id: '3', agent_id: 'a2', listing_id: 'l1', clicked_at: '2024-02-05T09:00:00.000Z' },
  { id: '4', agent_id: 'a2', listing_id: 'l3', clicked_at: '2024-03-15T14:00:00.000Z' },
];

const commissions = [
  { id: '1', agent_id: 'a1', status: 'pending', amount: 1000, created_at: '2024-01-05T00:00:00.000Z' },
  { id: '2', agent_id: 'a1', status: 'paid', amount: 500, created_at: '2024-01-20T00:00:00.000Z' },
  { id: '3', agent_id: 'a2', status: 'pending', amount: 750, created_at: '2024-02-01T00:00:00.000Z' },
  { id: '4', agent_id: 'a2', status: 'paid', amount: 300, created_at: '2024-03-01T00:00:00.000Z' },
];

// ── filterListings ─────────────────────────────────────────────────────────

describe('filterListings', () => {
  it('returns all listings when no filters are applied', () => {
    const result = filterListings(listings, {});
    expect(result).toHaveLength(4);
  });

  it('returns empty array for empty input', () => {
    expect(filterListings([], { agentId: 'a1' })).toHaveLength(0);
  });

  it('filters by agentId', () => {
    const result = filterListings(listings, { agentId: 'a1' });
    expect(result).toHaveLength(2);
    expect(result.every((l) => String(l.agent_id) === 'a1')).toBe(true);
  });

  it('filters by status = active', () => {
    const result = filterListings(listings, { status: 'active' });
    expect(result).toHaveLength(2);
    expect(result.every((l) => l.is_active)).toBe(true);
  });

  it('filters by status = inactive', () => {
    const result = filterListings(listings, { status: 'inactive' });
    expect(result).toHaveLength(2);
    expect(result.every((l) => !l.is_active)).toBe(true);
  });

  it('does not filter when status = all', () => {
    const result = filterListings(listings, { status: 'all' });
    expect(result).toHaveLength(4);
  });

  it('filters by location (case-insensitive substring)', () => {
    const result = filterListings(listings, { location: 'nairobi' });
    expect(result).toHaveLength(2);
    expect(result.map((l) => l.id)).toEqual(['1', '3']);
  });

  it('filters by location with exact case', () => {
    const result = filterListings(listings, { location: 'Westlands' });
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('2');
  });

  it('applies multiple filters simultaneously (AND semantics)', () => {
    const result = filterListings(listings, { agentId: 'a1', status: 'active' });
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('1');
  });

  it('returns empty array when no listings match all filters', () => {
    const result = filterListings(listings, { agentId: 'a1', status: 'inactive', location: 'Nairobi' });
    // a1 has one inactive listing in Westlands — no match for Nairobi
    expect(result).toHaveLength(0);
  });
});

// ── filterLeads ────────────────────────────────────────────────────────────

describe('filterLeads', () => {
  it('returns all leads when no filters are applied', () => {
    expect(filterLeads(leads, {})).toHaveLength(4);
  });

  it('returns empty array for empty input', () => {
    expect(filterLeads([], { agentId: 'a1' })).toHaveLength(0);
  });

  it('filters by agentId', () => {
    const result = filterLeads(leads, { agentId: 'a1' });
    expect(result).toHaveLength(2);
    expect(result.every((l) => String(l.agent_id) === 'a1')).toBe(true);
  });

  it('filters by listingId', () => {
    const result = filterLeads(leads, { listingId: 'l1' });
    expect(result).toHaveLength(2);
    expect(result.every((l) => String(l.listing_id) === 'l1')).toBe(true);
  });

  it('filters by startDate (inclusive)', () => {
    const result = filterLeads(leads, { startDate: '2024-02-01T00:00:00.000Z' });
    expect(result).toHaveLength(2);
    expect(result.map((l) => l.id)).toEqual(['3', '4']);
  });

  it('filters by endDate (inclusive)', () => {
    const result = filterLeads(leads, { endDate: '2024-01-31T23:59:59.000Z' });
    expect(result).toHaveLength(2);
    expect(result.map((l) => l.id)).toEqual(['1', '2']);
  });

  it('filters by date range (startDate + endDate)', () => {
    const result = filterLeads(leads, {
      startDate: '2024-01-01T00:00:00.000Z',
      endDate: '2024-01-31T23:59:59.000Z',
    });
    expect(result).toHaveLength(2);
    expect(result.map((l) => l.id)).toEqual(['1', '2']);
  });

  it('applies multiple filters simultaneously (AND semantics)', () => {
    const result = filterLeads(leads, { agentId: 'a1', listingId: 'l1' });
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('1');
  });

  it('returns empty array when no leads match all filters', () => {
    const result = filterLeads(leads, { agentId: 'a1', startDate: '2024-03-01T00:00:00.000Z' });
    expect(result).toHaveLength(0);
  });
});

// ── filterCommissions ──────────────────────────────────────────────────────

describe('filterCommissions', () => {
  it('returns all commissions when no filters are applied', () => {
    expect(filterCommissions(commissions, {})).toHaveLength(4);
  });

  it('returns empty array for empty input', () => {
    expect(filterCommissions([], { agentId: 'a1' })).toHaveLength(0);
  });

  it('filters by agentId', () => {
    const result = filterCommissions(commissions, { agentId: 'a1' });
    expect(result).toHaveLength(2);
    expect(result.every((c) => String(c.agent_id) === 'a1')).toBe(true);
  });

  it('filters by status = pending', () => {
    const result = filterCommissions(commissions, { status: 'pending' });
    expect(result).toHaveLength(2);
    expect(result.every((c) => c.status === 'pending')).toBe(true);
  });

  it('filters by status = paid', () => {
    const result = filterCommissions(commissions, { status: 'paid' });
    expect(result).toHaveLength(2);
    expect(result.every((c) => c.status === 'paid')).toBe(true);
  });

  it('does not filter when status = all', () => {
    const result = filterCommissions(commissions, { status: 'all' });
    expect(result).toHaveLength(4);
  });

  it('filters by startDate (inclusive)', () => {
    const result = filterCommissions(commissions, { startDate: '2024-02-01T00:00:00.000Z' });
    expect(result).toHaveLength(2);
    expect(result.map((c) => c.id)).toEqual(['3', '4']);
  });

  it('filters by endDate (inclusive)', () => {
    const result = filterCommissions(commissions, { endDate: '2024-01-31T23:59:59.000Z' });
    expect(result).toHaveLength(2);
    expect(result.map((c) => c.id)).toEqual(['1', '2']);
  });

  it('applies multiple filters simultaneously (AND semantics)', () => {
    const result = filterCommissions(commissions, { agentId: 'a1', status: 'pending' });
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('1');
  });

  it('returns empty array when no commissions match all filters', () => {
    const result = filterCommissions(commissions, { agentId: 'a1', status: 'pending', startDate: '2024-03-01T00:00:00.000Z' });
    expect(result).toHaveLength(0);
  });
});
