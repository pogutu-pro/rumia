'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { filterCommissions } from '@/lib/utils/admin-filters';
import { markCommissionPaidAction } from '@/app/actions/admin';

interface CommissionRow {
  id: string;
  agent_id: string | null;
  amount: number;
  status: 'pending' | 'paid';
  created_at: string;
  paid_at: string | null;
  agents: { id: string; name: string } | null;
  listings: { id: string; title: string } | null;
}

interface CommissionsTableClientProps {
  commissions: CommissionRow[];
  agents: Array<{ id: string; name: string }>;
  totalPending: number;
  totalPaid: number;
}

export function CommissionsTableClient({
  commissions,
  agents,
  totalPending,
  totalPaid,
}: CommissionsTableClientProps) {
  const router = useRouter();

  // Filter state
  const [agentFilter, setAgentFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'pending' | 'paid'>('all');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  // In-flight mutation state
  const [pendingId, setPendingId] = useState<string | null>(null);

  const hasActiveFilters =
    agentFilter !== '' || statusFilter !== 'all' || startDate !== '' || endDate !== '';

  function clearFilters() {
    setAgentFilter('');
    setStatusFilter('all');
    setStartDate('');
    setEndDate('');
  }

  // Convert date inputs to ISO strings before passing to filterCommissions (same pattern as leads page)
  const startISO = startDate
    ? new Date(startDate + 'T00:00:00.000Z').toISOString()
    : undefined;
  const endISO = endDate
    ? new Date(endDate + 'T00:00:00.000Z').toISOString()
    : undefined;

  const filtered = filterCommissions(commissions, {
    agentId: agentFilter || undefined,
    status: statusFilter === 'all' ? undefined : statusFilter,
    startDate: startISO,
    endDate: endISO,
  });

  async function handleMarkPaid(id: string) {
    setPendingId(id);
    try {
      const result = await markCommissionPaidAction(id);
      if (result.success) {
        toast.success('Commission marked as paid');
        router.refresh();
      } else {
        toast.error(result.error);
      }
    } finally {
      setPendingId(null);
    }
  }

  return (
    <div>
      {/* Page header row */}
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-semibold">Commissions</h1>
        <div className="flex items-center gap-6">
          <span className="text-sm font-medium text-amber-600">
            Pending: KES {totalPending.toLocaleString()}
          </span>
          <span className="text-sm font-medium text-green-600">
            Paid: KES {totalPaid.toLocaleString()}
          </span>
        </div>
      </div>

      {/* Filter bar */}
      <div className="bg-white rounded-lg border border-gray-200 p-4 mb-4 flex gap-4 flex-wrap items-center">
        {/* Agent dropdown */}
        <select
          value={agentFilter}
          onChange={(e) => setAgentFilter(e.target.value)}
          className="h-10 rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <option value="">All Agents</option>
          {agents.map((agent) => (
            <option key={agent.id} value={agent.id}>
              {agent.name}
            </option>
          ))}
        </select>

        {/* Status dropdown */}
        <select
          value={statusFilter}
          onChange={(e) =>
            setStatusFilter(e.target.value as 'all' | 'pending' | 'paid')
          }
          className="h-10 rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <option value="all">All</option>
          <option value="pending">Pending</option>
          <option value="paid">Paid</option>
        </select>

        {/* Start date */}
        <input
          type="date"
          value={startDate}
          onChange={(e) => setStartDate(e.target.value)}
          className="h-10 rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        />

        {/* End date */}
        <input
          type="date"
          value={endDate}
          onChange={(e) => setEndDate(e.target.value)}
          className="h-10 rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        />

        {/* Clear filters button — only shown when a filter is active */}
        {hasActiveFilters && (
          <Button variant="ghost" size="sm" onClick={clearFilters}>
            Clear filters
          </Button>
        )}
      </div>

      {/* Table */}
      <div className="bg-white rounded-lg border border-gray-200">
        <table className="w-full">
          <thead>
            <tr className="border-b border-gray-200">
              <th className="text-xs font-medium text-gray-500 uppercase tracking-wider text-left px-6 py-3">
                Agent Name
              </th>
              <th className="text-xs font-medium text-gray-500 uppercase tracking-wider text-left px-6 py-3">
                Listing Name
              </th>
              <th className="text-xs font-medium text-gray-500 uppercase tracking-wider text-left px-6 py-3">
                Amount (KES)
              </th>
              <th className="text-xs font-medium text-gray-500 uppercase tracking-wider text-left px-6 py-3">
                Status
              </th>
              <th className="text-xs font-medium text-gray-500 uppercase tracking-wider text-left px-6 py-3">
                Date Created
              </th>
              <th className="text-xs font-medium text-gray-500 uppercase tracking-wider text-left px-6 py-3">
                Date Paid
              </th>
              <th className="text-xs font-medium text-gray-500 uppercase tracking-wider text-left px-6 py-3">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {commissions.length === 0 ? (
              <tr>
                <td
                  colSpan={7}
                  className="text-sm text-gray-500 text-center px-6 py-8"
                >
                  No commission records.
                </td>
              </tr>
            ) : filtered.length === 0 ? (
              <tr>
                <td
                  colSpan={7}
                  className="text-sm text-gray-500 text-center px-6 py-8"
                >
                  No results match your filters.{' '}
                  <button
                    onClick={clearFilters}
                    className="text-blue-600 hover:underline"
                  >
                    Clear filters
                  </button>
                </td>
              </tr>
            ) : (
              filtered.map((commission) => (
                <tr
                  key={commission.id}
                  className="hover:bg-gray-50 transition-colors"
                >
                  {/* Agent Name */}
                  <td className="text-sm text-gray-700 px-6 py-4">
                    {commission.agents?.name ?? (
                      <span className="text-gray-400">—</span>
                    )}
                  </td>

                  {/* Listing Name */}
                  <td className="text-sm text-gray-700 px-6 py-4">
                    {commission.listings?.title ?? (
                      <span className="text-gray-400">—</span>
                    )}
                  </td>

                  {/* Amount */}
                  <td className="text-sm text-gray-700 px-6 py-4 font-medium">
                    {commission.amount.toLocaleString()}
                  </td>

                  {/* Status Badge */}
                  <td className="px-6 py-4">
                    {commission.status === 'paid' ? (
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                        Paid
                      </span>
                    ) : (
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-amber-100 text-amber-800">
                        Pending
                      </span>
                    )}
                  </td>

                  {/* Date Created */}
                  <td className="text-sm text-gray-600 px-6 py-4 whitespace-nowrap">
                    {new Date(commission.created_at).toLocaleDateString()}
                  </td>

                  {/* Date Paid */}
                  <td className="text-sm text-gray-600 px-6 py-4 whitespace-nowrap">
                    {commission.paid_at
                      ? new Date(commission.paid_at).toLocaleDateString()
                      : '—'}
                  </td>

                  {/* Actions */}
                  <td className="px-6 py-4">
                    {commission.status === 'pending' && (
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={pendingId === commission.id}
                        onClick={() => handleMarkPaid(commission.id)}
                      >
                        {pendingId === commission.id ? 'Saving…' : 'Mark as Paid'}
                      </Button>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
