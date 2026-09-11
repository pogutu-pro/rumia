'use client';

import { useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { toast } from 'sonner';
import { Edit, Eye, Loader2, CheckCircle2, XCircle, Trash2, MapPin } from 'lucide-react';
import { toggleBnbActiveAction, deleteBnbListingAction } from '@/app/actions/bnb';
import { formatCurrency } from '@/lib/utils/currency';

interface BnbListing {
  id: string;
  title: string;
  price: number;
  location: string;
  area?: string | null;
  is_active: boolean;
  listing_images: { r2_url: string }[];
}

export function BnbListingsClient({ initialListings }: { initialListings: BnbListing[] }) {
  const [listings, setListings] = useState(initialListings);
  const [togglingId, setTogglingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const handleToggle = async (id: string, current: boolean) => {
    if (togglingId) return;
    setTogglingId(id);
    const result = await toggleBnbActiveAction(id, !current);
    if (result.success) {
      setListings((p) => p.map((l) => l.id === id ? { ...l, is_active: !current } : l));
      toast.success(!current ? 'Listing published' : 'Listing paused');
    } else {
      toast.error(result.error ?? 'Failed to update status');
    }
    setTogglingId(null);
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this BnB listing? This cannot be undone.')) return;
    setDeletingId(id);
    const result = await deleteBnbListingAction(id);
    if (result.success) {
      setListings((p) => p.filter((l) => l.id !== id));
      toast.success('Listing deleted');
    } else {
      toast.error(result.error ?? 'Failed to delete');
    }
    setDeletingId(null);
  };

  if (listings.length === 0) {
    return (
      <div className="text-center py-16 bg-white border border-slate-100 rounded-2xl shadow-xs">
        <p className="text-slate-400 font-semibold text-sm">No BnB listings yet.</p>
        <p className="text-slate-400 text-xs mt-1">Create your first short-stay listing to get started.</p>
        <Link href="/dashboard/bnb/new"
          className="mt-5 inline-flex items-center px-5 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-sm font-bold shadow-xs transition-colors">
          Create first listing
        </Link>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
      {listings.map((item) => {
        const imageUrl = item.listing_images?.[0]?.r2_url
          ?? 'https://images.unsplash.com/photo-1555854877-bab0e564b8d5?q=80&w=600';

        return (
          <div key={item.id}
            className="bg-white rounded-2xl border border-slate-100 overflow-hidden shadow-xs hover:shadow-md transition-all duration-300 flex flex-col">
            <div className="relative aspect-4/3 bg-slate-100 overflow-hidden">
              <Image src={imageUrl} alt={item.title} fill sizes="(min-width: 768px) 33vw, 100vw" className="object-cover" />
              <div className="absolute top-3 left-3">
                {item.is_active ? (
                  <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-bold bg-emerald-50 text-emerald-700 border border-emerald-100 shadow-sm">
                    <CheckCircle2 className="h-3 w-3" /> Active
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-bold bg-slate-100 text-slate-600 border border-slate-200 shadow-sm">
                    <XCircle className="h-3 w-3" /> Paused
                  </span>
                )}
              </div>
              <div className="absolute top-3 right-3 bg-white/95 px-2 py-0.5 rounded-lg text-xs font-black shadow-xs">
                {formatCurrency(item.price)}
              </div>
            </div>

            <div className="p-4 flex-1 flex flex-col">
              <div className="flex items-center gap-1 text-slate-400 text-xs font-bold uppercase tracking-wider mb-1">
                <MapPin className="h-3 w-3" />
                <span className="truncate">{item.area || item.location}</span>
              </div>
              <h3 className="font-bold text-slate-900 line-clamp-1 mb-4">{item.title}</h3>

              <div className="pt-3 border-t border-slate-100 flex items-center justify-between gap-2 mt-auto">
                <div className="flex items-center gap-3">
                  <Link href={`/dashboard/bnb/edit/${item.id}`}
                    className="inline-flex items-center gap-1 text-slate-500 hover:text-slate-900 text-sm font-semibold transition-colors">
                    <Edit className="h-3.5 w-3.5" /> Edit
                  </Link>
                  <div className="w-1 h-1 rounded-full bg-slate-300" />
                  <Link href={`/listing/${item.id}`} target="_blank"
                    className="inline-flex items-center gap-1 text-slate-500 hover:text-slate-900 text-sm font-semibold transition-colors">
                    <Eye className="h-3.5 w-3.5" /> View
                  </Link>
                </div>

                <div className="flex items-center gap-2">
                  <button onClick={() => handleDelete(item.id)} disabled={!!deletingId}
                    className="p-1.5 text-slate-400 hover:text-rose-600 transition-colors disabled:opacity-50">
                    {deletingId === item.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                  </button>
                  <button onClick={() => handleToggle(item.id, item.is_active)} disabled={!!togglingId}
                    className={`inline-flex items-center px-3 py-1.5 rounded-xl text-xs font-bold transition-all border disabled:opacity-50 ${
                      item.is_active
                        ? 'bg-slate-50 text-slate-600 hover:bg-rose-50 hover:text-rose-600 border-slate-200'
                        : 'bg-emerald-50 text-emerald-600 hover:bg-emerald-100 border-emerald-100'
                    }`}>
                    {togglingId === item.id ? <Loader2 className="h-3 w-3 animate-spin" /> : item.is_active ? 'Pause' : 'Publish'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
