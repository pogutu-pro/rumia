'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { filterListings } from '@/lib/utils/admin-filters';
import { updateListingActiveAction, deleteListingAction } from '@/app/actions/admin';

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
  agents: Array<{ id: string; name: string }>;
}

const PAGE_SIZE = 20;

export function ListingsTableClient({ listings, agents }: ListingsTableClientProps) {
  const router = useRouter();

  // Filter state
  const [agentFilter, setAgentFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'inactive'>('all');
  const [locationFilter, setLocationFilter] = useState('');

  // Load-more state
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);

  // Pending action state
  const [pendingId, setPendingId] = useState<string | null>(null);

  const hasActiveFilters =
    agentFilter !== '' || statusFilter !== 'all' || locationFilter !== '';

  function clearFilters() {
    setAgentFilter('');
    setStatusFilter('all');
    setLocationFilter('');
    setVisibleCount(PAGE_SIZE);
  }

  const filtered = filterListings(listings, {
    agentId: agentFilter || undefined,
    status: statusFilter,
    location: locationFilter || undefined,
  });

  const visible = filtered.slice(0, visibleCount);
  const hasMore = filtered.length > visibleCount;

  async function handleToggleActive(listing: ListingRow) {
    if (listing.is_active) {
      const confirmed = window.confirm(
        `Deactivate "${listing.title}"? It will no longer appear in search results.`
      );
      if (!confirmed) return;
    }

    setPendingId(listing.id);
    const result = await updateListingActiveAction(listing.id, !listing.is_active);
    setPendingId(null);

    if (result.success) {
      toast.success(listing.is_active ? 'Listing deactivated' : 'Listing activated');
      router.refresh();
    } else {
      toast.error(result.error);
    }
  }

  async function handleDelete(listing: ListingRow) {
    const confirmed = window.confirm(
      `Permanently delete "${listing.title}"? This action cannot be undone.`
    );
    if (!confirmed) return;

    setPendingId(listing.id);
    const result = await deleteListingAction(listing.id);
    setPendingId(null);

    if (result.success) {
      toast.success('Listing deleted');
      router.refresh();
    } else {
      toast.error(result.error);
    }
  }

  return (
    <div>
      {/* Page title */}
      <h1 className="text-2xl font-semibold mb-6">Listings</h1>

      {/* Filter bar */}
      <div className="bg-white rounded-lg border border-gray-200 p-4 mb-4 flex gap-4 items-center flex-wrap">
        {/* Agent dropdown */}
        <select
          value={agentFilter}
          onChange={(e) => {
            setAgentFilter(e.target.value);
            setVisibleCount(PAGE_SIZE);
          }}
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
          onChange={(e) => {
            setStatusFilter(e.target.value as 'all' | 'active' | 'inactive');
            setVisibleCount(PAGE_SIZE);
          }}
          className="h-10 rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <option value="all">All</option>
          <option value="active">Active</option>
          <option value="inactive">Inactive</option>
        </select>

        {/* Location text input */}
        <input
          type="text"
          placeholder="Search by location..."
          value={locationFilter}
          onChange={(e) => {
            setLocationFilter(e.target.value);
            setVisibleCount(PAGE_SIZE);
          }}
          className="h-10 rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring min-w-[200px]"
        />

        {/* Clear filters button — only when a filter is active */}
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
                Photo
              </th>
              <th className="text-xs font-medium text-gray-500 uppercase tracking-wider text-left px-6 py-3">
                Hostel Name
              </th>
              <th className="text-xs font-medium text-gray-500 uppercase tracking-wider text-left px-6 py-3">
                Location
              </th>
              <th className="text-xs font-medium text-gray-500 uppercase tracking-wider text-left px-6 py-3">
                Price (KES)
              </th>
              <th className="text-xs font-medium text-gray-500 uppercase tracking-wider text-left px-6 py-3">
                Agent
              </th>
              <th className="text-xs font-medium text-gray-500 uppercase tracking-wider text-left px-6 py-3">
                Leads
              </th>
              <th className="text-xs font-medium text-gray-500 uppercase tracking-wider text-left px-6 py-3">
                Status
              </th>
              <th className="text-xs font-medium text-gray-500 uppercase tracking-wider text-left px-6 py-3">
                Created
              </th>
              <th className="text-xs font-medium text-gray-500 uppercase tracking-wider text-left px-6 py-3">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={9} className="text-sm text-gray-500 text-center px-6 py-8">
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
                    'No listings found.'
                  )}
                </td>
              </tr>
            ) : (
              visible.map((listing) => (
                <tr key={listing.id} className="hover:bg-gray-50 transition-colors">
                  {/* Photo */}
                  <td className="px-6 py-4">
                    {listing.cover_image ? (
                      <img
                        src={listing.cover_image}
                        alt={listing.title}
                        className="h-10 w-14 object-cover rounded"
                      />
                    ) : (
                      <div className="h-10 w-14 bg-gray-200 rounded" />
                    )}
                  </td>

                  {/* Hostel Name */}
                  <td className="text-sm px-6 py-4">
                    <Link
                      href={`/listing/${listing.id}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="font-medium text-gray-900 hover:text-blue-600 hover:underline"
                    >
                      {listing.title}
                    </Link>
                  </td>

                  {/* Location */}
                  <td className="text-sm text-gray-600 px-6 py-4">
                    {listing.location}
                  </td>

                  {/* Price */}
                  <td className="text-sm text-gray-600 px-6 py-4">
                    {listing.price.toLocaleString()}
                  </td>

                  {/* Agent */}
                  <td className="text-sm text-gray-600 px-6 py-4">
                    {listing.agent_name}
                  </td>

                  {/* Leads */}
                  <td className="text-sm text-gray-600 px-6 py-4">
                    {listing.leads_count}
                  </td>

                  {/* Status Badge */}
                  <td className="px-6 py-4">
                    {listing.is_active ? (
                      <span className="text-xs font-medium px-2.5 py-0.5 rounded-full bg-green-100 text-green-800">
                        Active
                      </span>
                    ) : (
                      <span className="text-xs font-medium px-2.5 py-0.5 rounded-full bg-gray-100 text-gray-600">
                        Inactive
                      </span>
                    )}
                  </td>

                  {/* Created */}
                  <td className="text-sm text-gray-600 px-6 py-4">
                    {new Date(listing.created_at).toLocaleDateString()}
                  </td>

                  {/* Actions */}
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3 text-sm">
                      <a
                        href={`/listing/${listing.id}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-blue-600 hover:underline whitespace-nowrap"
                      >
                        View Live
                      </a>
                      <button
                        onClick={() => handleToggleActive(listing)}
                        disabled={pendingId === listing.id}
                        className="text-amber-600 hover:underline disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap"
                      >
                        {pendingId === listing.id
                          ? '...'
                          : listing.is_active
                          ? 'Deactivate'
                          : 'Activate'}
                      </button>
                      <button
                        onClick={() => handleDelete(listing)}
                        disabled={pendingId === listing.id}
                        className="text-red-600 hover:underline disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        Delete
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Load More */}
      {hasMore && (
        <div className="mt-4 text-center">
          <Button
            variant="outline"
            onClick={() => setVisibleCount((c) => c + PAGE_SIZE)}
          >
            Load More
          </Button>
        </div>
      )}
    </div>
  );
}
