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

export function CommissionsTableClient({ commissions, agents, totalPending, totalPaid }: CommissionsTableClientProps) {
  const router = useRouter();
  const [agentFilter, setAgentFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'pending' | 'paid'>('all');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [pendingId, setPendingId] = useState<string | null>(null);

  const hasActiveFilters = agentFilter !== '' || statusFilter !== 'all' || startDate !== '' || endDate !== '';

  function clearFilters() {
    setAgentFilter(''); setStatusFilter('all'); setStartDate(''); setEndDate('');
  }

  const startISO = startDate ? new Date(startDate + 'T00:00:00.000Z').toISOString() : undefined;
  const endISO = endDate ? new Date(endDate + 'T00:00:00.000Z').toISOString() : undefined;

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
      if (result.success) { toast.success('Commission marked as paid'); router.refresh(); }
      else { toast.error(result.error); }
    } finally { setPendingId(null); }
  }

  return (
    <div>
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-6">
        <div>
          <h1 className="text-lg sm:text-2xl font-bold text-slate-900 tracking-tight">Commissions</h1>
          <p className="text-sm text-slate-500 mt-1">{commissions.length} commission{commissions.length !== 1 ? 's' : ''}</p>
        </div>
        <div className="flex items-center gap-4 text-sm">
          <span className="font-medium text-amber-600 bg-amber-50 px-3 py-1.5 rounded-lg">Pending: KES {totalPending.toLocaleString()}</span>
          <span className="font-medium text-emerald-600 bg-emerald-50 px-3 py-1.5 rounded-lg">Paid: KES {totalPaid.toLocaleString()}</span>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-2xl border border-slate-200/80 p-4 mb-4 flex flex-col sm:flex-row gap-3 shadow-sm">
        <select value={agentFilter} onChange={(e) => setAgentFilter(e.target.value)}
          className="h-10 rounded-lg border border-slate-200 bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500">
          <option value="">All Agents</option>
          {agents.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
        </select>
        <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value as any)}
          className="h-10 rounded-lg border border-slate-200 bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500">
          <option value="all">All</option><option value="pending">Pending</option><option value="paid">Paid</option>
        </select>
        <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)}
          className="h-10 rounded-lg border border-slate-200 bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500" />
        <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)}
          className="h-10 rounded-lg border border-slate-200 bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500" />
        {hasActiveFilters && <Button variant="ghost" size="sm" onClick={clearFilters} className="rounded-lg">Clear</Button>}
      </div>

      {/* Desktop table */}
      <div className="hidden md:block bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="border-b border-slate-200/80 bg-slate-50">
              {['Agent', 'Listing', 'Amount (KES)', 'Status', 'Created', 'Paid', 'Actions'].map((h) => (
                <th key={h} className="text-xs font-medium text-slate-500 uppercase tracking-wider text-left px-5 py-3">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-50">
            {commissions.length === 0 ? (
              <tr><td colSpan={7} className="text-sm text-slate-400 text-center px-5 py-8">No commission records.</td></tr>
            ) : filtered.length === 0 ? (
              <tr><td colSpan={7} className="text-sm text-slate-400 text-center px-5 py-8">No results match your filters.</td></tr>
            ) : filtered.map((c) => (
              <tr key={c.id} className="hover:bg-slate-50 transition-colors">
                <td className="text-sm text-slate-700 px-5 py-4">{c.agents?.name ?? '—'}</td>
                <td className="text-sm text-slate-700 px-5 py-4">{c.listings?.title ?? '—'}</td>
                <td className="text-sm text-slate-700 px-5 py-4 font-medium">{c.amount.toLocaleString()}</td>
                <td className="px-5 py-4">
                  {c.status === 'paid' ? (
                    <span className="text-xs font-medium px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-700">Paid</span>
                  ) : (
                    <span className="text-xs font-medium px-2.5 py-0.5 rounded-full bg-amber-50 text-amber-700">Pending</span>
                  )}
                </td>
                <td className="text-sm text-slate-500 px-5 py-4 whitespace-nowrap">{new Date(c.created_at).toLocaleDateString()}</td>
                <td className="text-sm text-slate-500 px-5 py-4 whitespace-nowrap">{c.paid_at ? new Date(c.paid_at).toLocaleDateString() : '—'}</td>
                <td className="px-5 py-4">
                  {c.status === 'pending' && (
                    <Button size="sm" variant="outline" disabled={pendingId === c.id} onClick={() => handleMarkPaid(c.id)} className="rounded-lg text-xs h-8">
                      {pendingId === c.id ? 'Saving…' : 'Mark as Paid'}
                    </Button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Mobile cards */}
      <div className="md:hidden space-y-3">
        {commissions.length === 0 ? (
          <div className="bg-white rounded-2xl border border-slate-200/80 p-5 text-center text-sm text-slate-400 shadow-sm">No commission records.</div>
        ) : filtered.length === 0 ? (
          <div className="bg-white rounded-2xl border border-slate-200/80 p-5 text-center text-sm text-slate-400 shadow-sm">No results match your filters.</div>
        ) : filtered.map((c) => (
          <div key={c.id} className="bg-white rounded-2xl border border-slate-200/80 p-4 shadow-sm space-y-3">
            <div className="flex items-start justify-between">
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-slate-900">{c.agents?.name ?? 'Unknown'}</p>
                <p className="text-xs text-slate-500 mt-0.5 truncate">{c.listings?.title ?? 'Unknown'}</p>
              </div>
              {c.status === 'paid' ? (
                <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700">Paid</span>
              ) : (
                <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-amber-50 text-amber-700">Pending</span>
              )}
            </div>
            <div className="flex items-center justify-between">
              <p className="text-base font-bold text-slate-900">KES {c.amount.toLocaleString()}</p>
              <p className="text-xs text-slate-400">{new Date(c.created_at).toLocaleDateString()}</p>
            </div>
            {c.status === 'pending' && (
              <Button size="sm" variant="outline" disabled={pendingId === c.id} onClick={() => handleMarkPaid(c.id)} className="rounded-lg text-xs h-9 w-full">
                {pendingId === c.id ? 'Saving…' : 'Mark as Paid'}
              </Button>
            )}
            {c.status === 'paid' && c.paid_at && (
              <p className="text-xs text-slate-400">Paid on {new Date(c.paid_at).toLocaleDateString()}</p>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
