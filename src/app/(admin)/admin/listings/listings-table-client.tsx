'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { filterListings } from '@/lib/utils/admin-filters';
import { updateListingActiveAction, deleteListingAction } from '@/app/actions/admin';
import { TransferOwnershipModal } from './transfer-ownership-modal';

interface ListingRow {
  id: string;
  title: string;
  location: string;
  price: number;
  is_active: boolean;
  created_at: string;
  leads_count: number;
  agent_name: string;
  agent_id: string;
  cover_image: string | null;
}

interface ListingsTableClientProps {
  listings: ListingRow[];
  agents: Array<{ id: string; name: string; status: string }>;
}

const PAGE_SIZE = 20;

export function ListingsTableClient({ listings, agents }: ListingsTableClientProps) {
  const router = useRouter();
  const [agentFilter, setAgentFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'inactive'>('all');
  const [locationFilter, setLocationFilter] = useState('');
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [transferListing, setTransferListing] = useState<ListingRow | null>(null);

  const hasActiveFilters = agentFilter !== '' || statusFilter !== 'all' || locationFilter !== '';

  function clearFilters() {
    setAgentFilter(''); setStatusFilter('all'); setLocationFilter(''); setVisibleCount(PAGE_SIZE);
  }

  const filtered = filterListings(listings, { agentId: agentFilter || undefined, status: statusFilter, location: locationFilter || undefined });
  const visible = filtered.slice(0, visibleCount);
  const hasMore = filtered.length > visibleCount;

  async function handleToggleActive(listing: ListingRow) {
    if (listing.is_active && !window.confirm(`Deactivate "${listing.title}"?`)) return;
    setPendingId(listing.id);
    const result = await updateListingActiveAction(listing.id, !listing.is_active);
    setPendingId(null);
    if (result.success) { toast.success(listing.is_active ? 'Deactivated' : 'Activated'); router.refresh(); }
    else { toast.error(result.error); }
  }

  async function handleDelete(listing: ListingRow) {
    if (!window.confirm(`Permanently delete "${listing.title}"?`)) return;
    setPendingId(listing.id);
    const result = await deleteListingAction(listing.id);
    setPendingId(null);
    if (result.success) { toast.success('Deleted'); router.refresh(); }
    else { toast.error(result.error); }
  }

  return (
    <div>
      <h1 className="text-xl sm:text-2xl font-bold text-gray-900 mb-1">Listings</h1>
      <p className="text-sm text-gray-500 mb-6">{listings.length} listing{listings.length !== 1 ? 's' : ''}</p>

      {/* Filters */}
      <div className="bg-white rounded-xl border border-gray-100 p-4 mb-4 flex flex-col sm:flex-row gap-3 shadow-sm">
        <select value={agentFilter} onChange={(e) => { setAgentFilter(e.target.value); setVisibleCount(PAGE_SIZE); }}
          className="h-10 rounded-lg border border-gray-200 bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500">
          <option value="">All Agents</option>
          {agents.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
        </select>
        <select value={statusFilter} onChange={(e) => { setStatusFilter(e.target.value as any); setVisibleCount(PAGE_SIZE); }}
          className="h-10 rounded-lg border border-gray-200 bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500">
          <option value="all">All</option><option value="active">Active</option><option value="inactive">Inactive</option>
        </select>
        <input type="text" placeholder="Search location..." value={locationFilter}
          onChange={(e) => { setLocationFilter(e.target.value); setVisibleCount(PAGE_SIZE); }}
          className="h-10 rounded-lg border border-gray-200 bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 min-w-[160px] flex-1" />
        {hasActiveFilters && <Button variant="ghost" size="sm" onClick={clearFilters} className="rounded-lg">Clear</Button>}
      </div>

      {/* Desktop table */}
      <div className="hidden md:block bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="border-b border-gray-100 bg-gray-50">
              {['Photo', 'Hostel', 'Location', 'Price (KES)', 'Agent', 'Leads', 'Status', 'Created', 'Actions'].map((h) => (
                <th key={h} className="text-xs font-medium text-gray-500 uppercase tracking-wider text-left px-5 py-3">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {filtered.length === 0 ? (
              <tr><td colSpan={9} className="text-sm text-gray-400 text-center px-5 py-8">No listings found.</td></tr>
            ) : visible.map((listing) => (
              <tr key={listing.id} className="hover:bg-gray-50 transition-colors">
                <td className="px-5 py-4">
                  {listing.cover_image ? (
                    <img src={listing.cover_image} alt={listing.title} className="h-10 w-14 object-cover rounded-lg" />
                  ) : <div className="h-10 w-14 bg-gray-100 rounded-lg" />}
                </td>
                <td className="text-sm px-5 py-4 font-medium text-gray-900">{listing.title}</td>
                <td className="text-sm text-gray-500 px-5 py-4">{listing.location}</td>
                <td className="text-sm text-gray-700 px-5 py-4">{listing.price.toLocaleString()}</td>
                <td className="text-sm text-gray-600 px-5 py-4">{listing.agent_name}</td>
                <td className="text-sm text-gray-600 px-5 py-4">{listing.leads_count}</td>
                <td className="px-5 py-4">
                  {listing.is_active ? (
                    <span className="text-xs font-medium px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-700">Active</span>
                  ) : (
                    <span className="text-xs font-medium px-2.5 py-0.5 rounded-full bg-gray-100 text-gray-600">Inactive</span>
                  )}
                </td>
                <td className="text-sm text-gray-500 px-5 py-4">{new Date(listing.created_at).toLocaleDateString()}</td>
                <td className="px-5 py-4">
                  <div className="flex items-center gap-2 text-sm">
                    <a href={`/listing/${listing.id}`} target="_blank" rel="noopener noreferrer" className="text-emerald-600 hover:underline font-medium">Live</a>
                    <button onClick={() => handleToggleActive(listing)} disabled={pendingId === listing.id}
                      className={`font-medium hover:underline disabled:opacity-50 ${listing.is_active ? 'text-amber-600' : 'text-emerald-600'}`}>
                      {listing.is_active ? 'Deactivate' : 'Activate'}
                    </button>
                    <button onClick={() => setTransferListing(listing)} className="text-indigo-600 font-medium hover:underline">Transfer</button>
                    <button onClick={() => handleDelete(listing)} disabled={pendingId === listing.id} className="text-red-500 font-medium hover:underline disabled:opacity-50">Delete</button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Mobile cards */}
      <div className="md:hidden space-y-3">
        {filtered.length === 0 ? (
          <div className="bg-white rounded-xl border border-gray-100 p-5 text-center text-sm text-gray-400 shadow-sm">No listings found.</div>
        ) : visible.map((listing) => (
          <div key={listing.id} className="bg-white rounded-xl border border-gray-100 p-4 shadow-sm space-y-3">
            <div className="flex items-start gap-3">
              {listing.cover_image ? (
                <img src={listing.cover_image} alt={listing.title} className="h-14 w-20 object-cover rounded-lg shrink-0" />
              ) : <div className="h-14 w-20 bg-gray-100 rounded-lg shrink-0" />}
              <div className="min-w-0 flex-1">
                <h3 className="text-sm font-semibold text-gray-900 leading-snug">{listing.title}</h3>
                <p className="text-xs text-gray-500 mt-0.5">{listing.location}</p>
                <p className="text-sm font-bold text-gray-900 mt-1">KES {listing.price.toLocaleString()}</p>
              </div>
              {listing.is_active ? (
                <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 shrink-0">Active</span>
              ) : (
                <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-gray-100 text-gray-600 shrink-0">Inactive</span>
              )}
            </div>
            <div className="flex items-center justify-between text-xs text-gray-500">
              <span>{listing.agent_name} &middot; {listing.leads_count} leads</span>
              <span>{new Date(listing.created_at).toLocaleDateString()}</span>
            </div>
            <div className="flex items-center gap-3 pt-1 text-xs font-medium">
              <a href={`/listing/${listing.id}`} target="_blank" rel="noopener noreferrer" className="text-emerald-600 hover:underline">View Live</a>
              <button onClick={() => handleToggleActive(listing)} disabled={pendingId === listing.id}
                className={`hover:underline disabled:opacity-50 ${listing.is_active ? 'text-amber-600' : 'text-emerald-600'}`}>
                {listing.is_active ? 'Deactivate' : 'Activate'}
              </button>
              <button onClick={() => setTransferListing(listing)} className="text-indigo-600 hover:underline">Transfer</button>
              <button onClick={() => handleDelete(listing)} disabled={pendingId === listing.id} className="text-red-500 hover:underline disabled:opacity-50">Delete</button>
            </div>
          </div>
        ))}
      </div>

      {hasMore && (
        <div className="mt-4 text-center">
          <Button variant="outline" onClick={() => setVisibleCount((c) => c + PAGE_SIZE)} className="rounded-xl">Load More</Button>
        </div>
      )}

      <TransferOwnershipModal
        open={!!transferListing}
        onOpenChange={(open) => { if (!open) setTransferListing(null); }}
        listing={transferListing ? { id: transferListing.id, title: transferListing.title, agent_name: transferListing.agent_name, agent_id: transferListing.agent_id } : null}
        agents={agents}
      />
    </div>
  );
}
