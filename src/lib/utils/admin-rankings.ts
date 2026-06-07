/**
 * Pure ranking and aggregation helpers for agent performance on
 * the Rumia Admin Panel Overview page.
 * No Supabase dependencies — all functions operate on plain arrays.
 */

import { countMonthlyLeads } from './admin-stats';

export interface RankedAgent {
  agent: { id: string; name: string };
  leadCount: number;
  commissionOwed: number;
}

/**
 * Ranks agents by their lead count for the current calendar month
 * (or a given `referenceDate`) in descending order.
 *
 * For each agent:
 * - `leadCount` is the number of leads attributed to that agent in the reference month.
 * - `commissionOwed` is the sum of pending commissions for that agent.
 *
 * Validates: Requirements 5.1, 5.2
 */
export function rankAgentsByLeads(
  agents: { id: string; name: string }[],
  leads: { agent_id: string; clicked_at: string }[],
  commissions: { agent_id: string; amount: number; status: string }[],
  referenceDate: Date = new Date(),
): RankedAgent[] {
  const ranked = agents.map((agent) => {
    const agentLeads = leads.filter((l) => l.agent_id === agent.id);
    const leadCount = countMonthlyLeads(agentLeads, referenceDate);
    const commissionOwed = computeAgentCommissionOwed(agent.id, commissions);

    return {
      agent,
      leadCount,
      commissionOwed,
    };
  });

  // Sort descending by lead count
  return ranked.sort((a, b) => b.leadCount - a.leadCount);
}

/**
 * Computes the total pending commission owed to a specific agent.
 * Returns the sum of `amount` for all commissions where
 * `agent_id === agentId` and `status === 'pending'`.
 *
 * Validates: Requirements 5.2
 */
export function computeAgentCommissionOwed(
  agentId: string,
  commissions: { agent_id: string; amount: number; status: string }[],
): number {
  return commissions
    .filter((c) => c.agent_id === agentId && c.status === 'pending')
    .reduce((sum, c) => sum + c.amount, 0);
}
