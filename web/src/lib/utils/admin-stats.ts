/**
 * Pure aggregation helpers for the Rumia Admin Panel stat cards.
 * No Supabase dependencies — all functions operate on plain arrays.
 */

/**
 * Counts the number of listings where `is_active === true`.
 * Validates: Requirements 3.2
 */
export function countActiveListings(listings: { is_active: boolean }[]): number {
  return listings.filter((l) => l.is_active).length;
}

/**
 * Counts leads whose `clicked_at` timestamp falls within the same
 * calendar month and year as `referenceDate` (defaults to today).
 * Validates: Requirements 3.3
 */
export function countMonthlyLeads(
  leads: { clicked_at: string }[],
  referenceDate: Date = new Date(),
): number {
  const refMonth = referenceDate.getUTCMonth();
  const refYear = referenceDate.getUTCFullYear();

  return leads.filter((lead) => {
    const d = new Date(lead.clicked_at);
    return d.getUTCMonth() === refMonth && d.getUTCFullYear() === refYear;
  }).length;
}

/**
 * Sums the `amount` field for all commissions where `status === 'pending'`.
 * Validates: Requirements 3.4
 */
export function sumPendingCommissions(
  commissions: { amount: number; status: string }[],
): number {
  return commissions
    .filter((c) => c.status === 'pending')
    .reduce((sum, c) => sum + c.amount, 0);
}

/**
 * Counts the number of agents where `status === 'active'`.
 * Validates: Requirements 3.5
 */
export function countActiveAgents(agents: { status: string }[]): number {
  return agents.filter((a) => a.status === 'active').length;
}
