'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { filterLeads } from '@/lib/utils/admin-filters';
import { CreateCommissionModal } from './create-commission-modal';

interface LeadRow {
  id: string;
  agent_id: string | null;
  listing_id: string | null;
  clicked_at: string;
  ip_hash: string;
  listings: { id: string; title: string } | null;
  agents: { id: string; name: string } | null;
}

interface LeadsTableClientProps {
  leads: LeadRow[];
  agents: Array<{ id: string; name: string }>;
  listings: Array<{ id: string; title: string }>;
}

type SelectedLead = {
  agentId: string;
  agentName: string;
  listingId: string;
  listingTitle: string;
} | null;

export function LeadsTableClient({ leads, agents, listings }: LeadsTableClientProps) {
  const [agentFilter, setAgentFilter] = useState('');
  const [listingFilter, setListingFilter] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [selectedLead, setSelectedLead] = useState<SelectedLead>(null);
  const [modalOpen, setModalOpen] = useState(false);

  const hasActiveFilters = agentFilter !== '' || listingFilter !== '' || startDate !== '' || endDate !== '';

  function clearFilters() {
    setAgentFilter(''); setListingFilter(''); setStartDate(''); setEndDate('');
  }

  const startISO = startDate ? new Date(startDate + 'T00:00:00.000Z').toISOString() : undefined;
  const endISO = endDate ? new Date(endDate + 'T00:00:00.000Z').toISOString() : undefined;

  const filtered = filterLeads(leads, {
    agentId: agentFilter || undefined,
    listingId: listingFilter || undefined,
    startDate: startISO,
    endDate: endISO,
  });

  function openCommissionModal(lead: LeadRow) {
    setSelectedLead({
      agentId: lead.agents?.id ?? '',
      agentName: lead.agents?.name ?? '—',
      listingId: lead.listings?.id ?? '',
      listingTitle: lead.listings?.title ?? '—',
    });
    setModalOpen(true);
  }

  return (
    <div>
      <h1 className="text-xl sm:text-2xl font-bold text-gray-900 mb-1">Leads</h1>
      <p className="text-sm text-gray-500 mb-6">{leads.length} lead{leads.length !== 1 ? 's' : ''} recorded</p>

      {/* Filters */}
      <div className="bg-white rounded-xl border border-gray-100 p-4 mb-4 flex flex-col sm:flex-row gap-3 shadow-sm">
        <select value={agentFilter} onChange={(e) => setAgentFilter(e.target.value)}
          className="h-10 rounded-lg border border-gray-200 bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500">
          <option value="">All Agents</option>
          {agents.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
        </select>
        <select value={listingFilter} onChange={(e) => setListingFilter(e.target.value)}
          className="h-10 rounded-lg border border-gray-200 bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500">
          <option value="">All Listings</option>
          {listings.map((l) => <option key={l.id} value={l.id}>{l.title}</option>)}
        </select>
        <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)}
          className="h-10 rounded-lg border border-gray-200 bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500" />
        <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)}
          className="h-10 rounded-lg border border-gray-200 bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500" />
        {hasActiveFilters && <Button variant="ghost" size="sm" onClick={clearFilters} className="rounded-lg">Clear</Button>}
      </div>

      {/* Desktop table */}
      <div className="hidden md:block bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="border-b border-gray-100 bg-gray-50">
              {['Date & Time', 'Listing', 'Agent', 'IP Hash', 'Actions'].map((h) => (
                <th key={h} className="text-xs font-medium text-gray-500 uppercase tracking-wider text-left px-5 py-3">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {filtered.length === 0 ? (
              <tr><td colSpan={5} className="text-sm text-gray-400 text-center px-5 py-8">No leads recorded.</td></tr>
            ) : filtered.map((lead) => {
              const date = new Date(lead.clicked_at);
              return (
                <tr key={lead.id} className="hover:bg-gray-50 transition-colors">
                  <td className="text-sm text-gray-600 px-5 py-4 whitespace-nowrap">
                    {date.toLocaleDateString()} {date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </td>
                  <td className="text-sm px-5 py-4">
                    {lead.listings ? (
                      <Link href={`/listing/${lead.listings.id}`} target="_blank" rel="noopener noreferrer" className="text-emerald-600 hover:underline font-medium">{lead.listings.title}</Link>
                    ) : <span className="text-gray-400">—</span>}
                  </td>
                  <td className="text-sm px-5 py-4">
                    {lead.agents ? (
                      <Link href={`/admin/agents/${lead.agents.id}`} className="text-emerald-600 hover:underline font-medium">{lead.agents.name}</Link>
                    ) : <span className="text-gray-400">—</span>}
                  </td>
                  <td className="text-sm text-gray-500 px-5 py-4 font-mono text-xs">{lead.ip_hash.slice(0, 12)}...</td>
                  <td className="px-5 py-4">
                    <Button size="sm" variant="outline" onClick={() => openCommissionModal(lead)} className="rounded-lg text-xs h-8">Create Commission</Button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Mobile cards */}
      <div className="md:hidden space-y-3">
        {filtered.length === 0 ? (
          <div className="bg-white rounded-xl border border-gray-100 p-5 text-center text-sm text-gray-400 shadow-sm">No leads recorded.</div>
        ) : filtered.map((lead) => (
          <div key={lead.id} className="bg-white rounded-xl border border-gray-100 p-4 shadow-sm space-y-3">
            <div className="flex items-start justify-between">
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-gray-900 truncate">{lead.listings?.title ?? 'Unknown Listing'}</p>
                <p className="text-xs text-gray-500 mt-0.5">{lead.agents?.name ?? 'Unknown Agent'}</p>
              </div>
              <span className="text-xs text-gray-400 shrink-0 ml-2">
                {new Date(lead.clicked_at).toLocaleDateString()}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-xs text-gray-400 font-mono">{lead.ip_hash.slice(0, 12)}...</span>
              <Button size="sm" variant="outline" onClick={() => openCommissionModal(lead)} className="rounded-lg text-xs h-8">Create Commission</Button>
            </div>
          </div>
        ))}
      </div>

      <CreateCommissionModal open={modalOpen} onOpenChange={setModalOpen} lead={selectedLead} />
    </div>
  );
}
