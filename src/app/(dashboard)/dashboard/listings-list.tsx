'use client';

import { useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { toast } from 'sonner';
import { MapPin, DollarSign, Eye, Edit, SwitchCamera, Loader2, CheckCircle2, XCircle, MessageCircle } from 'lucide-react';
import Link from 'next/link';

interface Listing {
  id: string | number;
  title: string;
  price: number;
  location: string;
  is_active: boolean;
  listing_images: { r2_url: string }[];
}

interface ListingsListProps {
  initialListings: Listing[];
  leadsCountByListing: Record<string, number>;
}

export function ListingsList({ initialListings, leadsCountByListing }: ListingsListProps) {
  const [listings, setListings] = useState<Listing[]>(initialListings);
  const [togglingId, setTogglingId] = useState<string | number | null>(null);
  const supabase = createClient();

  const handleToggleActive = async (id: string | number, currentStatus: boolean) => {
    if (togglingId) return;
    setTogglingId(id);

    try {
      const { error } = await supabase
        .from('listings')
        .update({ is_active: !currentStatus })
        .eq('id', id);

      if (error) throw error;

      setListings((prev) =>
        prev.map((item) => (item.id === id ? { ...item, is_active: !currentStatus } : item))
      );
      toast.success(
        `Listing marked as ${!currentStatus ? 'Active' : 'Inactive'}`
      );
    } catch (error) {
      console.error('Error toggling listing status:', error);
      toast.error('Failed to update listing status');
    } finally {
      setTogglingId(null);
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
                  <img
                    src={imageUrl}
                    alt={item.title}
                    className="object-cover w-full h-full"
                  />
                  
                  {/* Status Badge */}
                  <div className="absolute top-3 left-3">
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

                  <div className="flex items-center gap-1.5 text-emerald-600 mb-4 flex-1">
                    <MessageCircle className="h-4 w-4" />
                    <span className="text-sm font-bold">
                      {leadsCountByListing[String(item.id)] || 0} <span className="font-medium text-slate-500">Leads</span>
                    </span>
                  </div>

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
            );
          })}
        </div>
      )}
    </div>
  );
}
