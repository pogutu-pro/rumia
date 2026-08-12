'use client';

import type { FormEvent } from 'react';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { Loader2, X, Search } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { isValidKenyanPhone } from '@/lib/utils/phone';
import {
  updateListingStatusByManagerAction,
  updateListingOwnerPhoneByManagerAction,
  deleteListingByManagerAction,
} from '@/app/actions/manager';

export interface ManagerListingRow {
  id: string;
  slug: string | null;
  title: string;
  location: string;
  area: string | null;
  price: number;
  is_active: boolean;
  created_at: string;
  agent_name: string;
  leads_count: number;
  cover_image: string | null;
  landlord_phone: string | null;
}

const PAGE_SIZE = 20;

function OwnerPhoneDialog({
  listing,
  onClose,
  onSaved,
}: {
  listing: ManagerListingRow;
  onClose: () => void;
  onSaved: (listingId: string, phone: string | null) => void;
}) {
  const [phone, setPhone] = useState(listing.landlord_phone ?? '');
  const [isSaving, setIsSaving] = useState(false);

  const trimmedPhone = phone.trim();
  const hasInvalidPhone =
    trimmedPhone.length > 0 && !isValidKenyanPhone(trimmedPhone);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (hasInvalidPhone || isSaving) return;

    setIsSaving(true);
    const result = await updateListingOwnerPhoneByManagerAction(
      listing.id,
      trimmedPhone || null,
    );
    setIsSaving(false);

    if (result.success) {
      onSaved(listing.id, trimmedPhone || null);
      toast.success('Owner phone updated');
      onClose();
    } else {
      toast.error(result.error);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4"
      role="dialog"
      aria-modal="true"
      aria-label="Edit owner phone"
    >
      <form
        onSubmit={handleSubmit}
        className="w-full max-w-sm rounded-2xl bg-white p-5 shadow-xl"
      >
        <div className="mb-4 flex items-start justify-between gap-3">
          <div>
            <h2 className="text-base font-bold text-slate-900">Owner Phone</h2>
            <p className="mt-0.5 text-xs font-medium text-slate-500 line-clamp-1">
              {listing.title}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700"
            aria-label="Close"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="space-y-2">
          <Input
            type="tel"
            value={phone}
            onChange={(event) => setPhone(event.target.value)}
            placeholder="e.g. 0712 345 678"
            className={
              hasInvalidPhone
                ? 'border-rose-400 focus-visible:ring-rose-400'
                : ''
            }
            autoFocus
          />
          {hasInvalidPhone && (
            <p className="text-xs font-medium text-rose-600">
              Enter a valid Kenyan number, or clear the field.
            </p>
          )}
        </div>

        <div className="mt-5 flex justify-end gap-2">
          <Button
            type="button"
            variant="outline"
            onClick={onClose}
            className="rounded-lg"
          >
            Cancel
          </Button>
          <Button
            type="submit"
            disabled={isSaving || hasInvalidPhone}
            className="rounded-lg bg-emerald-600 hover:bg-emerald-700"
          >
            {isSaving ? (
              <Loader2 className="mr-1 h-4 w-4 animate-spin" />
            ) : null}
            Save
          </Button>
        </div>
      </form>
    </div>
  );
}

export function ManagerListingsClient({
  listings,
}: {
  listings: ManagerListingRow[];
}) {
  const router = useRouter();
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'inactive'>('all');
  const [search, setSearch] = useState('');
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [ownerPhoneListing, setOwnerPhoneListing] =
    useState<ManagerListingRow | null>(null);

  const hasActiveFilters = statusFilter !== 'all' || search !== '';

  function clearFilters() {
    setStatusFilter('all');
    setSearch('');
    setVisibleCount(PAGE_SIZE);
  }

  const filtered = listings.filter((listing) => {
    if (statusFilter !== 'all') {
      const shouldBeActive = statusFilter === 'active';
      if (listing.is_active !== shouldBeActive) return false;
    }
    if (search) {
      const haystack = `${listing.title} ${listing.location} ${listing.area ?? ''}`
        .toLowerCase();
      if (!haystack.includes(search.toLowerCase())) return false;
    }
    return true;
  });

  const visible = filtered.slice(0, visibleCount);
  const hasMore = filtered.length > visibleCount;

  async function handleToggleActive(listing: ManagerListingRow) {
    if (
      listing.is_active &&
      !window.confirm(
        `Suspend "${listing.title}"? It will be hidden from the public until reactivated.`,
      )
    ) {
      return;
    }
    setPendingId(listing.id);
    const result = await updateListingStatusByManagerAction(
      listing.id,
      !listing.is_active,
    );
    setPendingId(null);
    if (result.success) {
      toast.success(listing.is_active ? 'Listing suspended' : 'Listing activated');
      router.refresh();
    } else {
      toast.error(result.error);
    }
  }

  async function handleDelete(listing: ManagerListingRow) {
    if (
      !window.confirm(
        `Permanently delete "${listing.title}"? This action cannot be undone.`,
      )
    ) {
      return;
    }
    setPendingId(listing.id);
    const result = await deleteListingByManagerAction(listing.id);
    setPendingId(null);
    if (result.success) {
      toast.success('Listing deleted');
      router.refresh();
    } else {
      toast.error(result.error);
    }
  }

  function handleOwnerPhoneSaved(listingId: string, phone: string | null) {
    router.refresh();
  }

  const actionsCol = (
    listing: ManagerListingRow,
  ) => (
    <div className="flex flex-wrap items-center gap-2 text-sm">
      <a
        href={`/listing/${listing.id}`}
        target="_blank"
        rel="noopener noreferrer"
        className="text-emerald-600 hover:underline font-medium"
      >
        Live
      </a>
      <a
        href={`/manager/listings/edit/${listing.id}`}
        className="text-blue-600 hover:underline font-medium"
      >
        Edit
      </a>
      <button
        onClick={() => handleToggleActive(listing)}
        disabled={pendingId === listing.id}
        className={`font-medium hover:underline disabled:opacity-50 ${
          listing.is_active ? 'text-amber-600' : 'text-emerald-600'
        }`}
      >
        {pendingId === listing.id ? 'Working…' : listing.is_active ? 'Suspend' : 'Activate'}
      </button>
      <button
        onClick={() => setOwnerPhoneListing(listing)}
        className="text-indigo-600 font-medium hover:underline"
      >
        Owner Phone
      </button>
      <button
        onClick={() => handleDelete(listing)}
        disabled={pendingId === listing.id}
        className="text-red-500 font-medium hover:underline disabled:opacity-50"
      >
        Delete
      </button>
    </div>
  );

  return (
    <div>
      <div className="mb-1">
        <h1 className="text-lg sm:text-2xl font-bold text-slate-900 tracking-tight">
          Campus Listings
        </h1>
      </div>
      <p className="text-sm text-slate-500 mb-6">
        {listings.length} listing{listings.length !== 1 ? 's' : ''} scoped to
        your campus. You can edit, suspend, reactivate, or delete any
        agent-uploaded listing.
      </p>

      <div className="bg-white rounded-2xl border border-slate-200/80 p-4 mb-4 flex flex-col sm:flex-row gap-3 shadow-sm">
        <div className="relative flex-1 min-w-[160px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <input
            type="text"
            placeholder="Search title, location or area…"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setVisibleCount(PAGE_SIZE);
            }}
            className="h-10 w-full rounded-lg border border-gray-200 bg-background pl-9 pr-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
          />
        </div>
        <select
          value={statusFilter}
          onChange={(e) => {
            setStatusFilter(e.target.value as any);
            setVisibleCount(PAGE_SIZE);
          }}
          className="h-10 rounded-lg border border-gray-200 bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
        >
          <option value="all">All statuses</option>
          <option value="active">Active</option>
          <option value="inactive">Suspended</option>
        </select>
        {hasActiveFilters && (
          <Button
            variant="ghost"
            size="sm"
            onClick={clearFilters}
            className="rounded-lg"
          >
            Clear
          </Button>
        )}
      </div>

      {filtered.length === 0 ? (
        <div className="bg-white rounded-2xl border border-slate-200/80 p-12 text-center text-sm text-slate-400 shadow-sm">
          No listings found.
        </div>
      ) : (
        <>
          {/* Desktop table */}
          <div className="hidden md:block bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden">
            <table className="w-full">
              <thead>
                <tr className="border-b border-slate-200/80 bg-slate-50">
                  {['Photo', 'Hostel', 'Location', 'Price (KES)', 'Agent', 'Leads', 'Status', 'Created', 'Actions'].map((h) => (
                    <th
                      key={h}
                      className="text-xs font-medium text-slate-500 uppercase tracking-wider text-left px-5 py-3"
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {visible.map((listing) => (
                  <tr key={listing.id} className="hover:bg-slate-50 transition-colors">
                    <td className="px-5 py-4">
                      {listing.cover_image ? (
                        <img
                          src={listing.cover_image}
                          alt={listing.title}
                          className="h-10 w-14 object-cover rounded-lg"
                        />
                      ) : (
                        <div className="h-10 w-14 bg-slate-100 rounded-lg" />
                      )}
                    </td>
                    <td className="text-sm px-5 py-4 font-medium text-slate-900">
                      {listing.title}
                    </td>
                    <td className="text-sm text-slate-500 px-5 py-4">
                      {listing.location}
                      {listing.area ? ` (${listing.area})` : ''}
                    </td>
                    <td className="text-sm text-slate-700 px-5 py-4">
                      {listing.price.toLocaleString()}
                    </td>
                    <td className="text-sm text-slate-600 px-5 py-4">
                      {listing.agent_name}
                    </td>
                    <td className="text-sm text-slate-600 px-5 py-4">
                      {listing.leads_count}
                    </td>
                    <td className="px-5 py-4">
                      {listing.is_active ? (
                        <span className="text-xs font-medium px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-700">
                          Active
                        </span>
                      ) : (
                        <span className="text-xs font-medium px-2.5 py-0.5 rounded-full bg-rose-50 text-rose-600">
                          Suspended
                        </span>
                      )}
                    </td>
                    <td className="text-sm text-slate-500 px-5 py-4">
                      {new Date(listing.created_at).toLocaleDateString()}
                    </td>
                    <td className="px-5 py-4">{actionsCol(listing)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Mobile cards */}
          <div className="md:hidden space-y-3">
            {visible.map((listing) => (
              <div
                key={listing.id}
                className="bg-white rounded-2xl border border-slate-200/80 p-4 shadow-sm space-y-3"
              >
                <div className="flex items-start gap-3">
                  {listing.cover_image ? (
                    <img
                      src={listing.cover_image}
                      alt={listing.title}
                      className="h-14 w-20 object-cover rounded-lg shrink-0"
                    />
                  ) : (
                    <div className="h-14 w-20 bg-slate-100 rounded-lg shrink-0" />
                  )}
                  <div className="min-w-0 flex-1">
                    <h3 className="text-sm font-semibold text-slate-900 leading-snug">
                      {listing.title}
                    </h3>
                    <p className="text-xs text-slate-500 mt-0.5">
                      {listing.location}
                      {listing.area ? ` (${listing.area})` : ''}
                    </p>
                    <p className="text-sm font-bold text-slate-900 mt-1">
                      KES {listing.price.toLocaleString()}
                    </p>
                  </div>
                  <div className="shrink-0">
                    {listing.is_active ? (
                      <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700">
                        Active
                      </span>
                    ) : (
                      <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-rose-50 text-rose-600">
                        Suspended
                      </span>
                    )}
                  </div>
                </div>
                <div className="flex items-center justify-between text-xs text-slate-500">
                  <span>
                    {listing.agent_name} &middot; {listing.leads_count} leads
                  </span>
                  <span>{new Date(listing.created_at).toLocaleDateString()}</span>
                </div>
                <div className="pt-1">{actionsCol(listing)}</div>
              </div>
            ))}
          </div>

          {hasMore && (
            <div className="mt-4 text-center">
              <Button
                variant="outline"
                onClick={() => setVisibleCount((c) => c + PAGE_SIZE)}
                className="rounded-xl"
              >
                Load More
              </Button>
            </div>
          )}
        </>
      )}

      {ownerPhoneListing && (
        <OwnerPhoneDialog
          key={ownerPhoneListing.id}
          listing={ownerPhoneListing}
          onClose={() => setOwnerPhoneListing(null)}
          onSaved={handleOwnerPhoneSaved}
        />
      )}
    </div>
  );
}
