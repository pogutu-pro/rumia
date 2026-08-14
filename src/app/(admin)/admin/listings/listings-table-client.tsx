'use client';

import type { FormEvent } from 'react';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { formatDistanceToNow } from 'date-fns';
import {
  GripVertical,
  ArrowUpDown,
  ChevronUp,
  ChevronDown,
  ListOrdered,
  Save,
  X,
  Loader2,
  ShieldCheck,
  ShieldOff,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { filterListings } from '@/lib/utils/admin-filters';
import { isValidKenyanPhone } from '@/lib/utils/phone';
import {
  updateListingActiveAction,
  deleteListingAction,
  updateListingsOrderAction,
  shuffleListingsOrderAction,
  toggleCommissionLockAction,
  setListingCommissionAction,
  updateListingOwnerPhoneAction,
  toggleListingVerifiedAction,
} from '@/app/actions/admin';
import { TransferOwnershipModal } from './transfer-ownership-modal';
import { buildOrderPositions, moveListingWithin } from '@/lib/utils/listing-order';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  MouseSensor,
  TouchSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
  useSortable,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

interface ListingRow {
  id: string;
  title: string;
  location: string;
  price: number;
  is_active: boolean;
  verified?: boolean;
  created_at: string;
  sort_position: number | null;
  leads_count: number;
  agent_name: string;
  agent_id: string;
  cover_image: string | null;
  landlord_phone: string | null;
  pays_commission?: boolean;
  commission_locked_by_admin?: boolean;
}

interface ListingsTableClientProps {
  listings: ListingRow[];
  agents: Array<{ id: string; name: string; status: string }>;
  lastReorderAt?: string | null;
  hasCustomOrder?: boolean;
}

const PAGE_SIZE = 20;

function SortableRow({
  listing,
  index,
  isFirst,
  isLast,
  pendingId,
  onToggleActive,
  onTransfer,
  onDelete,
  onToggleCommission,
  onToggleCommissionLock,
  onEditOwnerPhone,
  onToggleVerified,
  onMove,
  isReorderMode,
}: {
  listing: ListingRow;
  index: number;
  isFirst: boolean;
  isLast: boolean;
  pendingId: string | null;
  onToggleActive: (l: ListingRow) => void;
  onTransfer: (l: ListingRow) => void;
  onDelete: (l: ListingRow) => void;
  onToggleCommission: (l: ListingRow) => void;
  onToggleCommissionLock: (l: ListingRow) => void;
  onEditOwnerPhone: (l: ListingRow) => void;
  onToggleVerified: (l: ListingRow) => void;
  onMove: (l: ListingRow, delta: number) => void;
  isReorderMode: boolean;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: listing.id, disabled: !isReorderMode });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    zIndex: isDragging ? 50 : undefined,
  };

  return (
    <tr
      ref={setNodeRef}
      style={style}
      className={`hover:bg-slate-50 transition-colors ${
        isDragging ? 'bg-emerald-50/60 shadow-lg ring-2 ring-emerald-300/70 opacity-90' : ''
      }`}
    >
      {isReorderMode && (
        <td className="px-2 py-4 w-20">
          <div className="flex items-center gap-1">
            <button
              {...attributes}
              {...listeners}
              className="p-2.5 rounded-lg cursor-grab active:cursor-grabbing text-slate-500 hover:text-slate-700 hover:bg-slate-100 touch-none select-none"
              title="Drag to reorder"
              aria-label={`Drag to reorder ${listing.title}`}
            >
              <GripVertical className="h-5 w-5" />
            </button>
            <div className="flex flex-col items-center gap-0.5">
              <button
                type="button"
                onClick={() => onMove(listing, -1)}
                disabled={isFirst}
                className="p-1 rounded text-slate-400 hover:text-slate-700 hover:bg-slate-100 disabled:opacity-30 disabled:hover:bg-transparent"
                aria-label={`Move ${listing.title} up`}
              >
                <ChevronUp className="h-3.5 w-3.5" />
              </button>
              <span className="text-xs font-semibold text-slate-400 tabular-nums">{index + 1}</span>
              <button
                type="button"
                onClick={() => onMove(listing, 1)}
                disabled={isLast}
                className="p-1 rounded text-slate-400 hover:text-slate-700 hover:bg-slate-100 disabled:opacity-30 disabled:hover:bg-transparent"
                aria-label={`Move ${listing.title} down`}
              >
                <ChevronDown className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
        </td>
      )}
      <td className="px-5 py-4">
        {listing.cover_image ? (
          <img src={listing.cover_image} alt={listing.title} className="h-10 w-14 object-cover rounded-lg" />
        ) : <div className="h-10 w-14 bg-slate-100 rounded-lg" />}
      </td>
      <td className="text-sm px-5 py-4 font-medium text-slate-900">{listing.title}</td>
      <td className="text-sm text-slate-500 px-5 py-4">{listing.location}</td>
      <td className="text-sm text-slate-700 px-5 py-4">{listing.price.toLocaleString()}</td>
      <td className="text-sm text-slate-600 px-5 py-4">{listing.agent_name}</td>
      <td className="text-sm text-slate-600 px-5 py-4">{listing.leads_count}</td>
      <td className="px-5 py-4">
        {listing.is_active ? (
          <span className="text-xs font-medium px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-700">Active</span>
        ) : (
          <span className="text-xs font-medium px-2.5 py-0.5 rounded-full bg-slate-100 text-slate-600">Inactive</span>
        )}
      </td>
      <td className="px-5 py-4">
        <button
          onClick={() => onToggleVerified(listing)}
          disabled={pendingId === listing.id}
          className={`inline-flex items-center gap-1 text-xs font-medium px-2.5 py-1 rounded-full transition-colors disabled:opacity-50 ${
            listing.verified
              ? 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100'
              : 'bg-slate-100 text-slate-500 hover:bg-slate-200'
          }`}
          title={listing.verified ? 'Click to unverify' : 'Click to verify'}
        >
          {listing.verified ? (
            <><ShieldCheck className="h-3.5 w-3.5" /> Verified</>
          ) : (
            <><ShieldOff className="h-3.5 w-3.5" /> Unverified</>
          )}
        </button>
      </td>
      <td className="px-5 py-4">
        <div className="flex flex-col gap-1">
          <span className="text-xs font-mono text-slate-600">
            {listing.landlord_phone || 'Not set'}
          </span>
          <button
            onClick={() => onEditOwnerPhone(listing)}
            className="text-xs font-medium text-emerald-600 hover:underline text-left"
          >
            Edit
          </button>
        </div>
      </td>
      <td className="px-5 py-4">
        <div className="flex flex-col gap-1">
          <button
            onClick={() => onToggleCommission(listing)}
            className={`text-xs font-medium px-2 py-0.5 rounded-full transition-colors ${
              listing.pays_commission
                ? 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100'
                : 'bg-amber-50 text-amber-700 hover:bg-amber-100'
            }`}
          >
            {listing.pays_commission ? 'Pays Comm.' : 'No Comm.'}
          </button>
          <button
            onClick={() => onToggleCommissionLock(listing)}
            className={`text-[10px] font-medium px-2 py-0.5 rounded-full transition-colors ${
              listing.commission_locked_by_admin
                ? 'bg-rose-50 text-rose-700 hover:bg-rose-100'
                : 'bg-slate-50 text-slate-500 hover:bg-slate-100'
            }`}
          >
            {listing.commission_locked_by_admin ? 'Locked' : 'Unlocked'}
          </button>
        </div>
      </td>
      <td className="text-sm text-slate-500 px-5 py-4">{new Date(listing.created_at).toLocaleDateString()}</td>
      <td className="px-5 py-4">
        <div className="flex items-center gap-2 text-sm">
          <a href={`/listing/${listing.id}`} target="_blank" rel="noopener noreferrer" className="text-emerald-600 hover:underline font-medium">Live</a>
          <a href={`/admin/listings/edit/${listing.id}`} className="text-blue-600 hover:underline font-medium">Edit</a>
          <a href={`/admin/listings/${listing.id}/leads`} className="text-indigo-600 hover:underline font-medium">
            Leads {listing.leads_count > 0 ? `(${listing.leads_count})` : ''}
          </a>
          <button onClick={() => onToggleActive(listing)} disabled={pendingId === listing.id}
            className={`font-medium hover:underline disabled:opacity-50 ${listing.is_active ? 'text-amber-600' : 'text-emerald-600'}`}>
            {listing.is_active ? 'Deactivate' : 'Activate'}
          </button>
          <button onClick={() => onTransfer(listing)} className="text-indigo-600 font-medium hover:underline">Transfer</button>
          <button onClick={() => onDelete(listing)} disabled={pendingId === listing.id} className="text-red-500 font-medium hover:underline disabled:opacity-50">Delete</button>
        </div>
      </td>
    </tr>
  );
}

function SortableMobileCard({
  listing,
  index,
  isFirst,
  isLast,
  pendingId,
  onToggleActive,
  onTransfer,
  onDelete,
  onToggleCommission,
  onToggleCommissionLock,
  onEditOwnerPhone,
  onToggleVerified,
  onMove,
  isReorderMode,
}: {
  listing: ListingRow;
  index: number;
  isFirst: boolean;
  isLast: boolean;
  pendingId: string | null;
  onToggleActive: (l: ListingRow) => void;
  onTransfer: (l: ListingRow) => void;
  onDelete: (l: ListingRow) => void;
  onToggleCommission: (l: ListingRow) => void;
  onToggleCommissionLock: (l: ListingRow) => void;
  onEditOwnerPhone: (l: ListingRow) => void;
  onToggleVerified: (l: ListingRow) => void;
  onMove: (l: ListingRow, delta: number) => void;
  isReorderMode: boolean;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: listing.id, disabled: !isReorderMode });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    zIndex: isDragging ? 50 : undefined,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`bg-white rounded-2xl border border-slate-200/80 p-4 shadow-sm space-y-3 ${
        isDragging ? 'shadow-xl ring-2 ring-emerald-300/70 border-emerald-300 opacity-90' : ''
      }`}
    >
      {isReorderMode && (
        <div className="flex items-center gap-1 -mx-1 px-1 pb-2 border-b border-slate-100">
          <button
            {...attributes}
            {...listeners}
            className="flex flex-1 items-center gap-3 py-3 -my-1 cursor-grab active:cursor-grabbing text-slate-500 touch-none select-none"
            title="Hold and drag to reorder"
            aria-label={`Drag to reorder ${listing.title}`}
          >
            <GripVertical className="h-7 w-7 text-slate-400" />
            <span className="text-xs font-medium text-slate-400">
              Hold & drag · #{index + 1}
            </span>
          </button>
          <div className="flex items-center gap-1 shrink-0">
            <button
              type="button"
              onClick={() => onMove(listing, -1)}
              disabled={isFirst}
              className="p-2.5 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-100 disabled:opacity-30 disabled:hover:bg-transparent"
              aria-label={`Move ${listing.title} up`}
            >
              <ChevronUp className="h-5 w-5" />
            </button>
            <button
              type="button"
              onClick={() => onMove(listing, 1)}
              disabled={isLast}
              className="p-2.5 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-100 disabled:opacity-30 disabled:hover:bg-transparent"
              aria-label={`Move ${listing.title} down`}
            >
              <ChevronDown className="h-5 w-5" />
            </button>
          </div>
        </div>
      )}
      <div className="flex items-start gap-3">
        {listing.cover_image ? (
          <img src={listing.cover_image} alt={listing.title} className="h-14 w-20 object-cover rounded-lg shrink-0" />
        ) : <div className="h-14 w-20 bg-slate-100 rounded-lg shrink-0" />}
        <div className="min-w-0 flex-1">
          <h3 className="text-sm font-semibold text-slate-900 leading-snug">{listing.title}</h3>
          <p className="text-xs text-slate-500 mt-0.5">{listing.location}</p>
          <p className="text-sm font-bold text-slate-900 mt-1">KES {listing.price.toLocaleString()}</p>
        </div>
        <div className="flex flex-col gap-1 items-end shrink-0">
          {listing.is_active ? (
            <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700">Active</span>
          ) : (
            <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-slate-100 text-slate-600">Inactive</span>
          )}
          <button
            onClick={() => onToggleVerified(listing)}
            disabled={pendingId === listing.id}
            className={`inline-flex items-center gap-1 text-[10px] font-medium px-2 py-0.5 rounded-full transition-colors disabled:opacity-50 ${
              listing.verified
                ? 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100'
                : 'bg-slate-100 text-slate-500 hover:bg-slate-200'
            }`}
          >
            {listing.verified ? (
              <><ShieldCheck className="h-3 w-3" /> Verified</>
            ) : (
              <><ShieldOff className="h-3 w-3" /> Unverified</>
            )}
          </button>
        </div>
      </div>
      <div className="flex items-center justify-between text-xs text-slate-500">
        <span>{listing.agent_name} &middot; {listing.leads_count} leads</span>
        <span>{new Date(listing.created_at).toLocaleDateString()}</span>
      </div>
      <div className="flex items-center justify-between gap-3 rounded-lg bg-slate-50 px-3 py-2">
        <span className="text-xs font-medium text-slate-500">Owner phone</span>
        <button
          onClick={() => onEditOwnerPhone(listing)}
          className="text-xs font-mono font-medium text-emerald-700 hover:underline"
        >
          {listing.landlord_phone || 'Set number'}
        </button>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <button
          onClick={() => onToggleCommission(listing)}
          className={`text-[10px] font-medium px-2 py-0.5 rounded-full transition-colors ${
            listing.pays_commission
              ? 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100'
              : 'bg-amber-50 text-amber-700 hover:bg-amber-100'
          }`}
        >
          {listing.pays_commission ? 'Pays Comm.' : 'No Comm.'}
        </button>
        <button
          onClick={() => onToggleCommissionLock(listing)}
          className={`text-[10px] font-medium px-2 py-0.5 rounded-full transition-colors ${
            listing.commission_locked_by_admin
              ? 'bg-rose-50 text-rose-700 hover:bg-rose-100'
              : 'bg-slate-50 text-slate-500 hover:bg-slate-100'
          }`}
        >
          {listing.commission_locked_by_admin ? 'Locked' : 'Unlocked'}
        </button>
      </div>
      <div className="flex items-center gap-3 pt-1 text-xs font-medium">
        <a href={`/listing/${listing.id}`} target="_blank" rel="noopener noreferrer" className="text-emerald-600 hover:underline">View Live</a>
        <a href={`/admin/listings/edit/${listing.id}`} className="text-blue-600 hover:underline">Edit</a>
        <a href={`/admin/listings/${listing.id}/leads`} className="text-indigo-600 hover:underline">
          Leads {listing.leads_count > 0 ? `(${listing.leads_count})` : ''}
        </a>
        <button onClick={() => onToggleActive(listing)} disabled={pendingId === listing.id}
          className={`hover:underline disabled:opacity-50 ${listing.is_active ? 'text-amber-600' : 'text-emerald-600'}`}>
          {listing.is_active ? 'Deactivate' : 'Activate'}
        </button>
        <button onClick={() => onTransfer(listing)} className="text-indigo-600 hover:underline">Transfer</button>
        <button onClick={() => onDelete(listing)} disabled={pendingId === listing.id} className="text-red-500 hover:underline disabled:opacity-50">Delete</button>
      </div>
    </div>
  );
}

function OwnerPhoneDialog({
  listing,
  onClose,
  onSaved,
}: {
  listing: ListingRow | null;
  onClose: () => void;
  onSaved: (listingId: string, phone: string | null) => void;
}) {
  const [phone, setPhone] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    setPhone(listing?.landlord_phone ?? '');
  }, [listing]);

  if (!listing) return null;

  const trimmedPhone = phone.trim();
  const hasInvalidPhone = trimmedPhone.length > 0 && !isValidKenyanPhone(trimmedPhone);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!listing || hasInvalidPhone || isSaving) return;

    setIsSaving(true);
    const result = await updateListingOwnerPhoneAction(
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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4" role="dialog" aria-modal="true" aria-label="Edit owner phone">
      <form onSubmit={handleSubmit} className="w-full max-w-sm rounded-2xl bg-white p-5 shadow-xl">
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
            className={hasInvalidPhone ? 'border-rose-400 focus-visible:ring-rose-400' : ''}
            autoFocus
          />
          {hasInvalidPhone && (
            <p className="text-xs font-medium text-rose-600">
              Enter a valid Kenyan number, or clear the field.
            </p>
          )}
        </div>

        <div className="mt-5 flex justify-end gap-2">
          <Button type="button" variant="outline" onClick={onClose} className="rounded-lg">
            Cancel
          </Button>
          <Button
            type="submit"
            disabled={isSaving || hasInvalidPhone}
            className="rounded-lg bg-emerald-600 hover:bg-emerald-700"
          >
            {isSaving ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : null}
            Save
          </Button>
        </div>
      </form>
    </div>
  );
}

export function ListingsTableClient({
  listings,
  agents,
  lastReorderAt = null,
  hasCustomOrder = false,
}: ListingsTableClientProps) {
  const router = useRouter();
  const [agentFilter, setAgentFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'inactive'>('all');
  const [locationFilter, setLocationFilter] = useState('');
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [transferListing, setTransferListing] = useState<ListingRow | null>(null);
  const [ownerPhoneListing, setOwnerPhoneListing] = useState<ListingRow | null>(null);
  const [isReorderMode, setIsReorderMode] = useState(false);
  const [orderedListings, setOrderedListings] = useState<ListingRow[]>(listings);
  const [isSavingOrder, setIsSavingOrder] = useState(false);
  const [isResettingOrder, setIsResettingOrder] = useState(false);
  const [hasOrderChanges, setHasOrderChanges] = useState(false);

  const sensors = useSensors(
    // Mouse: drag immediately. Touch: long-press (150ms) on the handle so
    // normal scrolling isn't hijacked. Keyboard stays for accessibility.
    useSensor(MouseSensor, { activationConstraint: { distance: 5 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 150, tolerance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const hasActiveFilters = agentFilter !== '' || statusFilter !== 'all' || locationFilter !== '';

  function clearFilters() {
    setAgentFilter(''); setStatusFilter('all'); setLocationFilter(''); setVisibleCount(PAGE_SIZE);
  }

  const filtered = filterListings(orderedListings, { agentId: agentFilter || undefined, status: statusFilter, location: locationFilter || undefined });
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

  async function handleToggleCommission(listing: ListingRow) {
    const newStatus = !listing.pays_commission;
    const result = await setListingCommissionAction(listing.id, newStatus);
    if (result.success) {
      toast.success(`Commission set to ${newStatus ? 'Pays Commission' : 'Consultation Fee'}`);
      router.refresh();
    } else {
      toast.error(result.error);
    }
  }

  async function handleToggleCommissionLock(listing: ListingRow) {
    const newLocked = !listing.commission_locked_by_admin;
    const result = await toggleCommissionLockAction(listing.id, newLocked);
    if (result.success) {
      toast.success(`Commission ${newLocked ? 'locked' : 'unlocked'} by admin`);
      router.refresh();
    } else {
      toast.error(result.error);
    }
  }

  function handleOwnerPhoneSaved(listingId: string, phone: string | null) {
    setOrderedListings((current) =>
      current.map((listing) =>
        listing.id === listingId ? { ...listing, landlord_phone: phone } : listing,
      ),
    );
    router.refresh();
  }

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const oldIndex = orderedListings.findIndex((l) => l.id === active.id);
    const newIndex = orderedListings.findIndex((l) => l.id === over.id);
    if (oldIndex === -1 || newIndex === -1) return;

    const reordered = arrayMove(orderedListings, oldIndex, newIndex);
    setOrderedListings(reordered);
    setHasOrderChanges(true);
  }

  // Move a listing one step up/down within the currently visible (filtered) list.
  function handleMove(listing: ListingRow, delta: number) {
    const next = moveListingWithin(orderedListings, filtered, listing.id, delta);
    if (next === orderedListings) return;
    setOrderedListings(next);
    setHasOrderChanges(true);
  }

  async function handleShuffleOrder() {
    if (
      !window.confirm(
        'Shuffle all listings into a random order? This replaces the current order.',
      )
    ) {
      return;
    }
    setIsResettingOrder(true);
    const result = await shuffleListingsOrderAction();
    setIsResettingOrder(false);

    if (result.success) {
      toast.success('Listings shuffled — random order');
      setIsReorderMode(false);
      setHasOrderChanges(false);
      router.refresh();
    } else {
      toast.error(result.error);
    }
  }

  async function handleSaveOrder() {
    setIsSavingOrder(true);
    const updates = buildOrderPositions(orderedListings);

    const result = await updateListingsOrderAction(updates);
    setIsSavingOrder(false);

    if (result.success) {
      toast.success('Order saved');
      setHasOrderChanges(false);
      router.refresh();
    } else {
      toast.error(result.error);
    }
  }

  function handleCancelReorder() {
    setOrderedListings(listings);
    setIsReorderMode(false);
    setHasOrderChanges(false);
  }

  function handleEnterReorderMode() {
    setIsReorderMode(true);
  }

  async function handleToggleVerified(listing: ListingRow) {
    const newVerified = !listing.verified;
    setPendingId(listing.id);
    const result = await toggleListingVerifiedAction(listing.id, newVerified);
    setPendingId(null);
    if (result.success) {
      toast.success(newVerified ? 'Listing marked as verified' : 'Listing verification removed');
      router.refresh();
    } else {
      toast.error(result.error);
    }
  }

  const desktopColCount = isReorderMode ? 13 : 12;

  return (
    <div>
      <div className="flex items-center justify-between mb-1">
        <h1 className="text-lg sm:text-2xl font-bold text-slate-900 tracking-tight">Listings</h1>
        <div className="flex items-center gap-2 flex-wrap justify-end">
          <Button
            variant="outline"
            size="sm"
            onClick={handleShuffleOrder}
            disabled={isResettingOrder}
            className="rounded-lg"
          >
            {isResettingOrder ? (
              <Loader2 className="h-4 w-4 mr-1 animate-spin" />
            ) : (
              <ListOrdered className="h-4 w-4 mr-1" />
            )}
            Reorder Listings
          </Button>
          {isReorderMode ? (
            <>
              <Button
                variant="outline"
                size="sm"
                onClick={handleCancelReorder}
                disabled={isSavingOrder}
                className="rounded-lg"
              >
                <X className="h-4 w-4 mr-1" />
                Cancel
              </Button>
              <Button
                size="sm"
                onClick={handleSaveOrder}
                disabled={isSavingOrder || !hasOrderChanges}
                className="bg-emerald-600 hover:bg-emerald-700 rounded-lg"
              >
                {isSavingOrder ? (
                  <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                ) : (
                  <Save className="h-4 w-4 mr-1" />
                )}
                Save Order
              </Button>
            </>
          ) : (
            <Button
              variant="outline"
              size="sm"
              onClick={handleEnterReorderMode}
              className="rounded-lg"
            >
              <ArrowUpDown className="h-4 w-4 mr-1" />
              Custom Order
            </Button>
          )}
        </div>
      </div>
      <div className="flex flex-col sm:flex-row sm:items-center gap-1 mb-6">
        <p className="text-sm text-slate-500">
          {listings.length} listing{listings.length !== 1 ? 's' : ''}
          {' · '}
          <span
            className={
              hasCustomOrder ? 'font-medium text-amber-600' : 'font-medium text-emerald-600'
            }
          >
            {hasCustomOrder ? 'custom order applied' : 'newest first'}
          </span>
        </p>
        {lastReorderAt && (
          <p className="text-xs text-slate-400 sm:ml-auto">
            Last reordered {formatDistanceToNow(new Date(lastReorderAt), { addSuffix: true })}
          </p>
        )}
      </div>

      {isReorderMode && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 mb-4 text-sm text-amber-800">
          Drag listings with the handle (long-press on touch) or use the up/down arrows. Position 1
          appears first on the public page. Click <strong>Save Order</strong> when done.
        </div>
      )}

      {/* Filters */}
      <div className="bg-white rounded-2xl border border-slate-200/80 p-4 mb-4 flex flex-col sm:flex-row gap-3 shadow-sm">
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
      <div className="hidden md:block bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden">
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
          <table className="w-full">
            <thead>
              <tr className="border-b border-slate-200/80 bg-slate-50">
                {isReorderMode && <th className="text-xs font-medium text-slate-500 uppercase tracking-wider text-left px-3 py-3 w-10"></th>}
                {['Photo', 'Hostel', 'Location', 'Price (KES)', 'Agent', 'Leads', 'Status', 'Verified', 'Owner Phone', 'Commission', 'Created', 'Actions'].map((h) => (
                  <th key={h} className="text-xs font-medium text-slate-500 uppercase tracking-wider text-left px-5 py-3">{h}</th>
                ))}
              </tr>
            </thead>
            <SortableContext items={orderedListings.map((l) => l.id)} strategy={verticalListSortingStrategy}>
              <tbody className="divide-y divide-slate-50">
                {filtered.length === 0 ? (
                  <tr><td colSpan={desktopColCount} className="text-sm text-slate-400 text-center px-5 py-8">No listings found.</td></tr>
                ) : visible.map((listing, index) => (
                  <SortableRow
                    key={listing.id}
                    listing={listing}
                    index={index}
                    isFirst={index === 0}
                    isLast={index === filtered.length - 1}
                    pendingId={pendingId}
                    onToggleActive={handleToggleActive}
                    onTransfer={setTransferListing}
                    onDelete={handleDelete}
                    onToggleCommission={handleToggleCommission}
                    onToggleCommissionLock={handleToggleCommissionLock}
                    onEditOwnerPhone={setOwnerPhoneListing}
                    onToggleVerified={handleToggleVerified}
                    onMove={handleMove}
                    isReorderMode={isReorderMode}
                  />
                ))}
              </tbody>
            </SortableContext>
          </table>
        </DndContext>
      </div>

      {/* Mobile cards */}
      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
        <div className="md:hidden space-y-3">
          <SortableContext items={orderedListings.map((l) => l.id)} strategy={verticalListSortingStrategy}>
            {filtered.length === 0 ? (
              <div className="bg-white rounded-2xl border border-slate-200/80 p-5 text-center text-sm text-slate-400 shadow-sm">No listings found.</div>
            ) : visible.map((listing, index) => (
              <SortableMobileCard
                key={listing.id}
                listing={listing}
                index={index}
                isFirst={index === 0}
                isLast={index === filtered.length - 1}
                pendingId={pendingId}
                onToggleActive={handleToggleActive}
                onTransfer={setTransferListing}
                onDelete={handleDelete}
                onToggleCommission={handleToggleCommission}
                onToggleCommissionLock={handleToggleCommissionLock}
                onEditOwnerPhone={setOwnerPhoneListing}
                onToggleVerified={handleToggleVerified}
                onMove={handleMove}
                isReorderMode={isReorderMode}
              />
            ))}
          </SortableContext>
        </div>
      </DndContext>

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

      <OwnerPhoneDialog
        listing={ownerPhoneListing}
        onClose={() => setOwnerPhoneListing(null)}
        onSaved={handleOwnerPhoneSaved}
      />
    </div>
  );
}
