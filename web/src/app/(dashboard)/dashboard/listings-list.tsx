'use client';

import { useState } from 'react';
import { toast } from 'sonner';
import { MapPin, DollarSign, Eye, Edit, SwitchCamera, Loader2, CheckCircle2, XCircle, MessageCircle } from 'lucide-react';
import Link from 'next/link';
import Image from 'next/image';
import { confirmAvailable, confirmedText, useWorkspace } from '@/components/dashboard/workspace';
import { toggleListingActiveAction, toggleListingFullAction, toggleListingCommissionAction } from '@/app/actions/listings';

interface Listing {
  id: string | number;
  title: string;
  slug?: string | null;
  price: number;
  location: string;
  is_active: boolean;
  is_full?: boolean;
  pays_commission?: boolean;
  commission_locked_by_admin?: boolean;
  listing_images: { r2_url: string }[];
}

interface ListingsListProps {
  initialListings: Listing[];
  leadsCountByListing: Record<string, number>;
}

export function ListingsList({ initialListings, leadsCountByListing }: ListingsListProps) {
  const [listings, setListings] = useState<Listing[]>(initialListings);
  const [togglingId, setTogglingId] = useState<string | number | null>(null);
  const [togglingFullId, setTogglingFullId] = useState<string | number | null>(null);
  const { ws, reload } = useWorkspace();
  const [confirmingId, setConfirmingId] = useState<string | number | null>(null);
  const propertyBySlug = new Map((ws?.properties ?? []).map((p) => [p.slug, p]));
  const [togglingCommissionId, setTogglingCommissionId] = useState<string | number | null>(null);

  const handleConfirm = async (id: string | number, propertyId: string) => {
    if (confirmingId) return;
    setConfirmingId(id);
    const ok = await confirmAvailable(propertyId);
    setConfirmingId(null);
    if (!ok) {
      toast.error('Could not confirm. Please try again.');
      return;
    }
    // Confirming makes it visible and available again.
    setListings((prev) => prev.map((item) => (item.id === id ? { ...item, is_active: true, is_full: false } : item)));
    toast.success('Confirmed as still available.');
    reload();
  };

  const handleToggleActive = async (id: string | number, currentStatus: boolean) => {
    if (togglingId) return;
    setTogglingId(id);

    try {
      const result = await toggleListingActiveAction(String(id));
      if (result.error) throw new Error(result.error);

      setListings((prev) =>
        prev.map((item) => (item.id === id ? { ...item, is_active: result.isActive ?? !currentStatus } : item))
      );
      toast.success(
        `Listing marked as ${result.isActive ? 'Active' : 'Inactive'}`
      );
    } catch (error) {
      console.error('Error toggling listing status:', error);
      toast.error('Failed to update listing status');
    } finally {
      setTogglingId(null);
    }
  };

  const handleToggleFull = async (id: string | number, currentFull: boolean) => {
    if (togglingFullId) return;
    setTogglingFullId(id);

    try {
      const result = await toggleListingFullAction(String(id));
      if (result.error) throw new Error(result.error);

      setListings((prev) =>
        prev.map((item) => (item.id === id ? { ...item, is_full: result.isFull ?? !currentFull } : item))
      );
      toast.success(
        result.isFull
          ? 'Hostel marked as not available — visitors will be directed to you for recommendations'
          : 'Hostel marked as having availability'
      );
    } catch (error) {
      console.error('Error toggling full status:', error);
      toast.error('Failed to update full status');
    } finally {
      setTogglingFullId(null);
    }
  };

  const handleToggleCommission = async (id: string | number, currentStatus: boolean, isLocked: boolean) => {
    if (togglingCommissionId || isLocked) return;
    setTogglingCommissionId(id);

    try {
      const result = await toggleListingCommissionAction(String(id));
      if (result.error) throw new Error(result.error);

      setListings((prev) =>
        prev.map((item) => (item.id === id ? { ...item, pays_commission: result.paysCommission ?? !currentStatus } : item))
      );
      toast.success(
        `Commission set to ${result.paysCommission ? 'Pays Commission' : 'Consultation Fee'}`
      );
    } catch (error) {
      console.error('Error toggling commission status:', error);
      toast.error('Failed to update commission status');
    } finally {
      setTogglingCommissionId(null);
    }
  };

  return (
    <div className="space-y-6">
      {listings.length === 0 ? (
        <div className="text-center py-16 bg-white border border-slate-100 rounded-2xl shadow-xs">
          <p className="text-slate-400 font-semibold">You haven&apos;t created any listings yet.</p>
          <Link
            href="/dashboard/new"
            className="mt-4 inline-flex items-center px-5 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-sm font-bold shadow-xs transition-colors"
          >
            Create Your First Listing
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {listings.map((item) => {
            const imageUrl =
              item.listing_images?.[0]?.r2_url ||
              'https://images.unsplash.com/photo-1555854877-bab0e564b8d5?q=80&w=600';

            return (
              <div
                key={item.id}
                className="bg-white rounded-2xl border border-slate-100 overflow-hidden shadow-xs hover:shadow-md transition-all duration-300 flex flex-col"
              >
                <div className="relative aspect-4/3 bg-slate-100 overflow-hidden">
                  <Image
                    src={imageUrl}
                    alt={item.title}
                    fill
                    sizes="(min-width: 768px) 33vw, 100vw"
                    className="object-cover"
                  />
                  
                  {/* Status Badge */}
                  <div className="absolute top-3 left-3 flex items-center gap-1.5">
                    {item.is_full && item.is_active ? (
                      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-bold bg-amber-50 text-amber-700 border border-amber-100 shadow-sm">
                        Full
                      </span>
                    ) : null}
                    {item.is_active ? (
                      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-bold bg-emerald-50 text-emerald-700 border border-emerald-100 shadow-sm">
                        <CheckCircle2 className="h-3 w-3" />
                        Active
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-bold bg-rose-50 text-rose-700 border border-rose-100 shadow-sm">
                        <XCircle className="h-3 w-3" />
                        Inactive
                      </span>
                    )}
                  </div>

                  <div className="absolute top-3 right-3 bg-white/95 px-2 py-0.5 rounded-lg text-xs font-black shadow-xs">
                    KES {item.price.toLocaleString()}/mo
                  </div>
                </div>

                <div className="p-4 flex-1 flex flex-col">
                  <div className="flex items-center gap-1 text-slate-400 text-xs font-bold uppercase tracking-wider mb-1">
                    <MapPin className="h-3 w-3" />
                    <span className="truncate">{item.location}</span>
                  </div>
                  
                  <h3 className="font-bold text-slate-900 line-clamp-1 mb-2">
                    {item.title}
                  </h3>

                  <div className="flex items-center justify-between mb-4 flex-1">
                    <div className="flex items-center gap-1.5 text-emerald-600">
                      <MessageCircle className="h-4 w-4" />
                      <span className="text-sm font-bold">
                        {leadsCountByListing[String(item.id)] || 0} <span className="font-medium text-slate-500">Leads</span>
                      </span>
                    </div>
                    {item.pays_commission !== undefined && (
                      <button
                        onClick={() => handleToggleCommission(item.id, !!item.pays_commission, !!item.commission_locked_by_admin)}
                        disabled={togglingCommissionId === item.id || !!item.commission_locked_by_admin}
                        title={item.commission_locked_by_admin ? "Locked by admin" : "Toggle commission status"}
                        className={`inline-flex items-center px-2 py-1 rounded-lg text-[10px] font-bold transition-all border ${
                          item.pays_commission
                            ? 'bg-emerald-50 text-emerald-600 hover:bg-emerald-100 border-emerald-100'
                            : 'bg-amber-50 text-amber-600 hover:bg-amber-100 border-amber-100'
                        } disabled:opacity-50`}
                      >
                        {togglingCommissionId === item.id ? (
                          <Loader2 className="h-3 w-3 animate-spin" />
                        ) : item.pays_commission ? (
                          'Pays Comm.'
                        ) : (
                          'No Comm.'
                        )}
                      </button>
                    )}
                  </div>

                  {/* Freshness: people trust places the owner has recently confirmed */}
                  {(() => {
                    const property = item.slug ? propertyBySlug.get(item.slug) : undefined;
                    if (!property) return null;
                    return (
                      <div className="flex items-center justify-between gap-2 pb-3">
                        <p className="text-xs text-slate-500">{confirmedText(property.last_confirmed_at)}</p>
                        <button
                          type="button"
                          onClick={() => handleConfirm(item.id, property.id)}
                          disabled={confirmingId === item.id}
                          className="inline-flex min-h-9 items-center gap-1 rounded-lg border border-emerald-200 bg-emerald-50 px-2.5 text-xs font-semibold text-emerald-800 hover:bg-emerald-100 disabled:opacity-60"
                        >
                          {confirmingId === item.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <CheckCircle2 className="h-3.5 w-3.5" />}
                          Still available
                        </button>
                      </div>
                    );
                  })()}

                  {/* Actions & Toggle */}
                  <div className="pt-3 border-t border-slate-100 flex items-center justify-between gap-2">
                    <div className="flex items-center gap-3">
                      <Link
                        href={`/dashboard/edit/${item.id}`}
                        className="text-slate-500 hover:text-slate-900 text-sm font-semibold transition-colors"
                      >
                        Edit
                      </Link>
                      <div className="w-1 h-1 rounded-full bg-slate-300"></div>
                      <Link
                        href={`/listing/${item.id}`}
                        target="_blank"
                        className="text-slate-500 hover:text-slate-900 text-sm font-semibold transition-colors"
                      >
                        View Live
                      </Link>
                    </div>

                    <div className="flex items-center gap-2">
                      {item.is_active && (
                        <button
                          onClick={() => handleToggleFull(item.id, !!item.is_full)}
                          disabled={togglingFullId === item.id}
                          title={item.is_full ? 'Mark as having availability' : 'Mark as not available'}
                          className={`inline-flex items-center gap-2 px-2.5 py-1.5 rounded-xl text-xs font-bold transition-all border ${
                            item.is_full
                              ? 'bg-amber-50 text-amber-700 border-amber-200'
                              : 'bg-emerald-50 text-emerald-700 border-emerald-200'
                          } disabled:opacity-50`}
                        >
                          <span
                            className={`relative inline-flex h-4 w-7 shrink-0 items-center rounded-full transition-colors ${
                              item.is_full ? 'bg-amber-500' : 'bg-emerald-500'
                            }`}
                          >
                            <span
                              className={`inline-block h-3 w-3 transform rounded-full bg-white shadow-sm transition-transform ${
                                item.is_full ? 'translate-x-3.5' : 'translate-x-0.5'
                              }`}
                            />
                          </span>
                          {togglingFullId === item.id ? (
                            <Loader2 className="h-3 w-3 animate-spin" />
                          ) : item.is_full ? (
                            'Not Available'
                          ) : (
                            'Available'
                          )}
                        </button>
                      )}
                      <button
                        onClick={() => handleToggleActive(item.id, item.is_active)}
                        disabled={togglingId === item.id}
                        className={`inline-flex items-center px-3 py-1.5 rounded-xl text-xs font-bold transition-all border ${
                          item.is_active
                            ? 'bg-rose-50 text-rose-600 hover:bg-rose-100 border-rose-100'
                            : 'bg-emerald-50 text-emerald-600 hover:bg-emerald-100 border-emerald-100'
                        } disabled:opacity-50`}
                      >
                        {togglingId === item.id ? (
                          <Loader2 className="h-3 w-3 animate-spin" />
                        ) : item.is_active ? (
                          'Deactivate'
                        ) : (
                          'Activate'
                        )}
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
