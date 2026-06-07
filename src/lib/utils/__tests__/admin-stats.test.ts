import {
  countActiveListings,
  countMonthlyLeads,
  sumPendingCommissions,
  countActiveAgents,
} from '../admin-stats';

// ── countActiveListings ────────────────────────────────────────────────────

describe('countActiveListings', () => {
  it('returns 0 for an empty array', () => {
    expect(countActiveListings([])).toBe(0);
  });

  it('counts all listings when all are active', () => {
    const listings = [{ is_active: true }, { is_active: true }, { is_active: true }];
    expect(countActiveListings(listings)).toBe(3);
  });

  it('returns 0 when none are active', () => {
    const listings = [{ is_active: false }, { is_active: false }];
    expect(countActiveListings(listings)).toBe(0);
  });

  it('counts only active listings in a mixed array', () => {
    const listings = [
      { is_active: true },
      { is_active: false },
      { is_active: true },
      { is_active: false },
    ];
    expect(countActiveListings(listings)).toBe(2);
  });

  it('handles a single active listing', () => {
    expect(countActiveListings([{ is_active: true }])).toBe(1);
  });

  it('handles a single inactive listing', () => {
    expect(countActiveListings([{ is_active: false }])).toBe(0);
  });
});

// ── countMonthlyLeads ──────────────────────────────────────────────────────

describe('countMonthlyLeads', () => {
  // Use a fixed reference date for determinism (UTC — the function uses UTC methods)
  const jan2024 = new Date('2024-01-15T00:00:00.000Z');

  it('returns 0 for an empty array', () => {
    expect(countMonthlyLeads([], jan2024)).toBe(0);
  });

  it('counts leads in the same calendar month', () => {
    const leads = [
      { clicked_at: '2024-01-01T00:00:00.000Z' },
      { clicked_at: '2024-01-31T23:59:59.000Z' },
    ];
    expect(countMonthlyLeads(leads, jan2024)).toBe(2);
  });

  it('excludes leads from a different month', () => {
    const leads = [
      { clicked_at: '2024-02-01T00:00:00.000Z' }, // February — excluded
      { clicked_at: '2024-01-15T10:00:00.000Z' }, // January — included
    ];
    expect(countMonthlyLeads(leads, jan2024)).toBe(1);
  });

  it('excludes leads from the same month but different year', () => {
    const leads = [
      { clicked_at: '2023-01-10T00:00:00.000Z' }, // Different year
      { clicked_at: '2024-01-10T00:00:00.000Z' }, // Same month/year
    ];
    expect(countMonthlyLeads(leads, jan2024)).toBe(1);
  });

  it('returns 0 when no leads fall in the reference month', () => {
    const leads = [
      { clicked_at: '2024-03-15T00:00:00.000Z' },
      { clicked_at: '2023-01-01T00:00:00.000Z' },
    ];
    expect(countMonthlyLeads(leads, jan2024)).toBe(0);
  });

  it('uses current month when no referenceDate is provided (sanity check)', () => {
    // Just verify it returns a number without throwing
    const result = countMonthlyLeads([]);
    expect(typeof result).toBe('number');
  });
});

// ── sumPendingCommissions ──────────────────────────────────────────────────

describe('sumPendingCommissions', () => {
  it('returns 0 for an empty array', () => {
    expect(sumPendingCommissions([])).toBe(0);
  });

  it('sums all amounts when all are pending', () => {
    const commissions = [
      { amount: 1000, status: 'pending' },
      { amount: 2500, status: 'pending' },
    ];
    expect(sumPendingCommissions(commissions)).toBe(3500);
  });

  it('returns 0 when all are paid', () => {
    const commissions = [
      { amount: 1000, status: 'paid' },
      { amount: 500, status: 'paid' },
    ];
    expect(sumPendingCommissions(commissions)).toBe(0);
  });

  it('sums only pending amounts in a mixed array', () => {
    const commissions = [
      { amount: 1000, status: 'pending' },
      { amount: 500, status: 'paid' },
      { amount: 750, status: 'pending' },
    ];
    expect(sumPendingCommissions(commissions)).toBe(1750);
  });

  it('handles decimal amounts', () => {
    const commissions = [
      { amount: 100.5, status: 'pending' },
      { amount: 200.25, status: 'pending' },
    ];
    expect(sumPendingCommissions(commissions)).toBeCloseTo(300.75);
  });

  it('handles a single pending commission', () => {
    expect(sumPendingCommissions([{ amount: 4200, status: 'pending' }])).toBe(4200);
  });
});

// ── countActiveAgents ──────────────────────────────────────────────────────

describe('countActiveAgents', () => {
  it('returns 0 for an empty array', () => {
    expect(countActiveAgents([])).toBe(0);
  });

  it('counts all agents when all are active', () => {
    const agents = [{ status: 'active' }, { status: 'active' }];
    expect(countActiveAgents(agents)).toBe(2);
  });

  it('returns 0 when all are suspended', () => {
    const agents = [{ status: 'suspended' }, { status: 'suspended' }];
    expect(countActiveAgents(agents)).toBe(0);
  });

  it('counts only active agents in a mixed array', () => {
    const agents = [
      { status: 'active' },
      { status: 'suspended' },
      { status: 'active' },
    ];
    expect(countActiveAgents(agents)).toBe(2);
  });

  it('handles a single active agent', () => {
    expect(countActiveAgents([{ status: 'active' }])).toBe(1);
  });

  it('handles a single suspended agent', () => {
    expect(countActiveAgents([{ status: 'suspended' }])).toBe(0);
  });
});
