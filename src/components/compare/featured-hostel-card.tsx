'use client';

import React, { useCallback } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { MapPin, ArrowRight, GitCompareArrows, Check } from 'lucide-react';
import { toast } from 'sonner';
import { useCompareStore, type CompareSelection } from '@/stores/compare-store';

interface Listing {
  id: string;
  title: string;
  description: string;
  price: number;
  location: string;
  slug?: string | null;
  county?: string | null;
  area?: string | null;
  agents?: { name: string } | null;
  listing_images?: {
    r2_url: string;
    display_order: number;
    blur_data_url?: string | null;
  }[] | null;
}

export function FeaturedHostelCard({
  item,
  index,
}: {
  item: Listing;
  index: number;
}) {
  const addSelection = useCompareStore((s) => s.addSelection);
  const removeSelection = useCompareStore((s) => s.removeSelection);
  const selected = useCompareStore((s) => s.isSelected(item.id));

  const sortedImages = (item.listing_images || []).sort(
    (a: any, b: any) => a.display_order - b.display_order,
  );
  const imageUrl =
    sortedImages[0]?.r2_url ||
    'https://images.unsplash.com/photo-1555854877-bab0e564b8d5?q=80&w=600';
  const blurDataUrl = sortedImages[0]?.blur_data_url;

  const href = item.slug
    ? `/hostels/${item.county || 'nyeri'}/${item.area || 'dekut'}/${item.slug}`
    : `/listing/${item.id}`;

  const handleCompare = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();
      if (selected) {
        removeSelection(item.id);
        toast.info(`${item.title} removed from comparison`);
        return;
      }
      const result = addSelection({
        id: item.id,
        title: item.title,
        price: item.price,
        imageUrl,
        slug: item.slug,
        county: item.county,
        area: item.area,
        agentName: item.agents?.name ?? null,
      });
      if (result.ok) {
        const count = useCompareStore.getState().selectedIds.length;
        if (count === 1) {
          toast.success(`${item.title} added`, {
            description: 'Select one more hostel to start comparing.',
          });
        } else {
          toast.success(`${item.title} added to comparison`);
        }
      } else if (result.reason === 'max_reached') {
        toast.error('Maximum hostels reached', {
          description: 'Remove a hostel first before adding another.',
        });
      }
    },
    [selected, item, imageUrl, addSelection, removeSelection],
  );

  return (
    <div className="group flex flex-col bg-white border border-slate-100 rounded-2xl overflow-hidden hover:shadow-xl hover:-translate-y-1 transition-all duration-300 h-full">
      <Link href={href} className="block">
        <div className="relative aspect-4/3 overflow-hidden bg-slate-100">
          <Image
            src={imageUrl}
            alt={`${item.title} — student hostel near DeKUT Nyeri`}
            fill
            className="object-cover transition-transform duration-500 group-hover:scale-105"
            sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 25vw"
            placeholder={blurDataUrl ? 'blur' : undefined}
            blurDataURL={blurDataUrl || undefined}
            priority={index === 0}
          />
          <div className="absolute top-3 right-3 bg-white/95 backdrop-blur-xs px-2.5 py-1 rounded-lg text-xs font-bold shadow-sm text-slate-900 border border-slate-100/50">
            KES {item.price.toLocaleString()}/mo
          </div>
        </div>
      </Link>

      <div className="p-4 flex-1 flex flex-col">
        <div className="flex items-center gap-1 text-slate-400 text-xs font-semibold mb-1 uppercase tracking-wider">
          <MapPin className="h-3 w-3 shrink-0 text-slate-400" />
          <span className="truncate">{item.location}</span>
        </div>

        <Link href={href}>
          <h3 className="font-bold text-slate-900 line-clamp-1 group-hover:text-emerald-600 transition-colors">
            {item.title}
          </h3>
        </Link>

        <p className="text-slate-500 text-sm line-clamp-2 mt-1 mb-4 flex-1">
          {item.description}
        </p>

        <div className="pt-3 border-t border-slate-100 flex items-center justify-between text-xs text-slate-400">
          <span>Agent: {item.agents?.name || 'Rumia Agent'}</span>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleCompare}
              className="inline-flex items-center gap-1 rounded-lg bg-slate-900 px-2.5 py-1 text-[11px] font-bold text-white transition-all duration-200 cursor-pointer hover:bg-slate-700"
            >
              {selected ? (
                <><Check className="h-3 w-3" /> Added</>
              ) : (
                <><GitCompareArrows className="h-3 w-3" /> Compare</>
              )}
            </button>
            <Link
              href={href}
              className="font-semibold text-emerald-600 group-hover:underline flex items-center gap-0.5"
            >
              Details
              <ArrowRight className="h-3 w-3" />
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
