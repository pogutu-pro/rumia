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

export function LeadsTableClient({
  leads,
  agents,
  listings,
}: LeadsTableClientProps) {
  // Filter state
  const [agentFilter, setAgentFilter] = useState('');
  const [listingFilter, setListingFilter] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  // Commission modal state
  const [selectedLead, setSelectedLead] = useState<SelectedLead>(null);
  const [modalOpen, setModalOpen] = useState(false);

  const hasActiveFilters =
    agentFilter !== '' || listingFilter !== '' || startDate !== '' || endDate !== '';

  function clearFilters() {
    setAgentFilter('');
    setListingFilter('');
    setStartDate('');
    setEndDate('');
  }

  // Convert date inputs to ISO strings for filterLeads
  const startISO = startDate
    ? new Date(startDate + 'T00:00:00.000Z').toISOString()
    : undefined;
  const endISO = endDate
    ? new Date(endDate + 'T00:00:00.000Z').toISOString()
    : undefined;

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
      {/* Page title */}
      <h1 className="text-2xl font-semibold mb-2">Leads</h1>
      <p className="text-sm text-gray-500 mb-6">
        Each row represents one WhatsApp button click. Commissions are created manually
        by admin after verifying placement.
      </p>

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

        {/* Listing dropdown */}
        <select
          value={listingFilter}
          onChange={(e) => setListingFilter(e.target.value)}
          className="h-10 rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <option value="">All Listings</option>
          {listings.map((listing) => (
            <option key={listing.id} value={listing.id}>
              {listing.title}
            </option>
          ))}
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

        {/* Clear filters button */}
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
                Date &amp; Time
              </th>
              <th className="text-xs font-medium text-gray-500 uppercase tracking-wider text-left px-6 py-3">
                Listing Name
              </th>
              <th className="text-xs font-medium text-gray-500 uppercase tracking-wider text-left px-6 py-3">
                Agent Name
              </th>
              <th className="text-xs font-medium text-gray-500 uppercase tracking-wider text-left px-6 py-3">
                IP Hash
              </th>
              <th className="text-xs font-medium text-gray-500 uppercase tracking-wider text-left px-6 py-3">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {filtered.length === 0 ? (
              <tr>
                <td
                  colSpan={5}
                  className="text-sm text-gray-500 text-center px-6 py-8"
                >
                  {hasActiveFilters ? (
                    <span>
                      No results match your filters.{' '}
                      <button
                        onClick={clearFilters}
                        className="text-blue-600 hover:underline"
                      >
                        Clear filters
                      </button>
                    </span>
                  ) : (
                    'No leads recorded.'
                  )}
                </td>
              </tr>
            ) : (
              filtered.map((lead) => {
                const date = new Date(lead.clicked_at);
                const dateStr = date.toLocaleDateString();
                const timeStr = date.toLocaleTimeString([], {
                  hour: '2-digit',
                  minute: '2-digit',
                });
                const ipTruncated =
                  lead.ip_hash.length > 12
                    ? lead.ip_hash.slice(0, 12) + '...'
                    : lead.ip_hash;

                return (
                  <tr key={lead.id} className="hover:bg-gray-50 transition-colors">
                    {/* Date & Time */}
                    <td className="text-sm text-gray-600 px-6 py-4 whitespace-nowrap">
                      {dateStr} {timeStr}
                    </td>

                    {/* Listing Name */}
                    <td className="text-sm px-6 py-4">
                      {lead.listings ? (
                        <Link
                          href={`/listing/${lead.listings.id}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-blue-600 hover:underline"
                        >
                          {lead.listings.title}
                        </Link>
                      ) : (
                        <span className="text-gray-400">—</span>
                      )}
                    </td>

                    {/* Agent Name */}
                    <td className="text-sm px-6 py-4">
                      {lead.agents ? (
                        <Link
                          href={`/admin/agents/${lead.agents.id}`}
                          className="text-blue-600 hover:underline"
                        >
                          {lead.agents.name}
                        </Link>
                      ) : (
                        <span className="text-gray-400">—</span>
                      )}
                    </td>

                    {/* IP Hash */}
                    <td className="text-sm text-gray-600 px-6 py-4">
                      <span title={lead.ip_hash} className="font-mono text-xs">
                        {ipTruncated}
                      </span>
                    </td>

                    {/* Actions */}
                    <td className="px-6 py-4">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => openCommissionModal(lead)}
                      >
                        Create Commission
                      </Button>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Create Commission Modal */}
      <CreateCommissionModal
        open={modalOpen}
        onOpenChange={setModalOpen}
        lead={selectedLead}
      />
    </div>
  );
}
