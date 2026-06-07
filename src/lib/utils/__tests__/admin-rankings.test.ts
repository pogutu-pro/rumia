import { rankAgentsByLeads, computeAgentCommissionOwed } from '../admin-rankings';

// ── computeAgentCommissionOwed ─────────────────────────────────────────────

describe('computeAgentCommissionOwed', () => {
  const commissions = [
    { agent_id: 'a1', amount: 1000, status: 'pending' },
    { agent_id: 'a1', amount: 500, status: 'paid' },
    { agent_id: 'a1', amount: 750, status: 'pending' },
    { agent_id: 'a2', amount: 2000, status: 'pending' },
  ];

  it('returns 0 for an empty commissions array', () => {
    expect(computeAgentCommissionOwed('a1', [])).toBe(0);
  });

  it('returns 0 when agent has no commissions', () => {
    expect(computeAgentCommissionOwed('a99', commissions)).toBe(0);
  });

  it('returns sum of pending commissions for a specific agent', () => {
    // a1 has 1000 + 750 pending (500 is paid)
    expect(computeAgentCommissionOwed('a1', commissions)).toBe(1750);
  });

  it('excludes paid commissions from the sum', () => {
    // a1's paid commission (500) must be excluded
    const result = computeAgentCommissionOwed('a1', commissions);
    expect(result).not.toBe(2250); // Would be 2250 if paid was included
    expect(result).toBe(1750);
  });

  it('sums pending commissions for another agent', () => {
    expect(computeAgentCommissionOwed('a2', commissions)).toBe(2000);
  });

  it('returns 0 when agent has only paid commissions', () => {
    const onlyPaid = [{ agent_id: 'a1', amount: 500, status: 'paid' }];
    expect(computeAgentCommissionOwed('a1', onlyPaid)).toBe(0);
  });
});

// ── rankAgentsByLeads ──────────────────────────────────────────────────────

describe('rankAgentsByLeads', () => {
  const agents = [
    { id: 'a1', name: 'Alice' },
    { id: 'a2', name: 'Bob' },
    { id: 'a3', name: 'Charlie' },
  ];

  const jan2024 = new Date('2024-01-15T00:00:00.000Z');

  const leads = [
    { agent_id: 'a1', clicked_at: '2024-01-05T08:00:00.000Z' },
    { agent_id: 'a1', clicked_at: '2024-01-12T10:00:00.000Z' },
    { agent_id: 'a1', clicked_at: '2024-01-20T09:00:00.000Z' },
    { agent_id: 'a2', clicked_at: '2024-01-08T14:00:00.000Z' },
    { agent_id: 'a2', clicked_at: '2024-01-22T11:00:00.000Z' },
    { agent_id: 'a3', clicked_at: '2024-01-15T16:00:00.000Z' },
    // Different month — excluded
    { agent_id: 'a1', clicked_at: '2024-02-10T08:00:00.000Z' },
    { agent_id: 'a2', clicked_at: '2023-01-10T08:00:00.000Z' },
  ];

  const commissions = [
    { agent_id: 'a1', amount: 1000, status: 'pending' },
    { agent_id: 'a1', amount: 500, status: 'paid' },
    { agent_id: 'a2', amount: 750, status: 'pending' },
  ];

  it('returns an empty array when agents array is empty', () => {
    expect(rankAgentsByLeads([], leads, commissions, jan2024)).toHaveLength(0);
  });

  it('returns one entry per agent', () => {
    const result = rankAgentsByLeads(agents, leads, commissions, jan2024);
    expect(result).toHaveLength(3);
  });

  it('ranks agents in descending order by monthly lead count', () => {
    const result = rankAgentsByLeads(agents, leads, commissions, jan2024);
    // a1: 3 leads, a2: 2 leads, a3: 1 lead
    expect(result[0].agent.id).toBe('a1');
    expect(result[0].leadCount).toBe(3);
    expect(result[1].agent.id).toBe('a2');
    expect(result[1].leadCount).toBe(2);
    expect(result[2].agent.id).toBe('a3');
    expect(result[2].leadCount).toBe(1);
  });

  it('the result is in non-increasing lead count order', () => {
    const result = rankAgentsByLeads(agents, leads, commissions, jan2024);
    for (let i = 0; i < result.length - 1; i++) {
      expect(result[i].leadCount).toBeGreaterThanOrEqual(result[i + 1].leadCount);
    }
  });

  it('counts only leads in the reference month (excludes other months)', () => {
    const result = rankAgentsByLeads(agents, leads, commissions, jan2024);
    // a1 has a February lead that must not be counted
    const alice = result.find((r) => r.agent.id === 'a1')!;
    expect(alice.leadCount).toBe(3); // Not 4
  });

  it('computes commissionOwed as sum of pending commissions per agent', () => {
    const result = rankAgentsByLeads(agents, leads, commissions, jan2024);
    const alice = result.find((r) => r.agent.id === 'a1')!;
    expect(alice.commissionOwed).toBe(1000); // Only pending; paid (500) excluded

    const bob = result.find((r) => r.agent.id === 'a2')!;
    expect(bob.commissionOwed).toBe(750);

    const charlie = result.find((r) => r.agent.id === 'a3')!;
    expect(charlie.commissionOwed).toBe(0);
  });

  it('gives a leadCount of 0 for agents with no leads in the month', () => {
    const result = rankAgentsByLeads(agents, [], commissions, jan2024);
    result.forEach((r) => expect(r.leadCount).toBe(0));
  });

  it('includes agent object reference in each ranked result', () => {
    const result = rankAgentsByLeads(agents, leads, commissions, jan2024);
    result.forEach((r) => {
      expect(r.agent).toHaveProperty('id');
      expect(r.agent).toHaveProperty('name');
    });
  });
});
