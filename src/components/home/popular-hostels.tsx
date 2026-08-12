'use client';

import Link from 'next/link';
import Image from 'next/image';
import { MapPin, TrendingUp, ArrowRight, Eye, GitCompareArrows, Check } from 'lucide-react';
import { useCompareStore, type CompareSelection } from '@/stores/compare-store';
import { useCallback } from 'react';
import { useCampus } from '@/lib/campus-context';

interface PopularListing {
  id: string;
  title: string;
  description: string;
  price: number;
  location: string;
  slug: string | null;
  county: string | null;
  area: string | null;
  view_count: number;
  agent_name: string | null;
  r2_url: string | null;
  blur_data_url: string | null;
}

function PopularCard({ item, index }: { item: PopularListing; index: number }) {
  const addSelection = useCompareStore((s) => s.addSelection);
  const removeSelection = useCompareStore((s) => s.removeSelection);
  const isSelected = useCompareStore((s) => s.isSelected(item.id));
  const campus = useCampus();
  const shortName = campus.short_name ?? 'DeKUT';
  const city = campus.city ?? 'Nyeri';

  const href = item.slug
    ? `/hostels/${item.county || 'nyeri'}/${item.area || 'dekut'}/${item.slug}`
    : `/listing/${item.id}`;

  const handleCompare = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();
      if (isSelected) {
        removeSelection(item.id);
        return;
      }
      const selection: CompareSelection = {
        id: item.id,
        title: item.title,
        price: item.price,
        imageUrl: item.r2_url || 'https://images.unsplash.com/photo-1555854877-bab0e564b8d5?q=80&w=600',
        slug: item.slug,
        county: item.county,
        area: item.area,
        agentName: item.agent_name,
      };
      addSelection(selection);
    },
    [isSelected, item, addSelection, removeSelection],
  );

  return (
    <Link
      href={href}
      className="group flex flex-col bg-white border border-slate-100 rounded-2xl overflow-hidden hover:shadow-xl hover:-translate-y-1 transition-all duration-300 h-full"
    >
      <div className="relative aspect-4/3 overflow-hidden bg-slate-100">
        <Image
          src={
            item.r2_url ||
            'https://images.unsplash.com/photo-1555854877-bab0e564b8d5?q=80&w=600'
          }
          alt={`${item.title} — popular student hostel near ${shortName} ${city}`}
          fill
          className="object-cover transition-transform duration-500 group-hover:scale-105"
          sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
          placeholder={item.blur_data_url ? 'blur' : undefined}
          blurDataURL={item.blur_data_url || undefined}
          priority={index < 3}
        />

        <div className="absolute top-3 left-3 w-8 h-8 rounded-full bg-slate-900/80 backdrop-blur-sm flex items-center justify-center text-white text-xs font-black border border-white/20">
          {index + 1}
        </div>

        <div className="absolute top-3 right-3 inline-flex items-center gap-1 bg-white/95 backdrop-blur-xs px-2.5 py-1 rounded-lg text-xs font-bold shadow-sm text-slate-700 border border-slate-100/50">
          <Eye className="h-3 w-3 text-slate-400" />
          {item.view_count.toLocaleString()}
        </div>

        <div className="absolute bottom-3 right-3 bg-emerald-600/90 backdrop-blur-sm px-2.5 py-1 rounded-lg text-xs font-bold text-white shadow-sm">
          KES {item.price.toLocaleString()}/mo
        </div>
      </div>

      <div className="p-4 flex-1 flex flex-col">
        <div className="flex items-center gap-1 text-slate-400 text-xs font-semibold mb-1 uppercase tracking-wider">
          <MapPin className="h-3 w-3 shrink-0 text-slate-400" />
          <span className="truncate">{item.location}</span>
        </div>

        <h3 className="font-bold text-slate-900 line-clamp-1 group-hover:text-emerald-600 transition-colors">
          {item.title}
        </h3>

        <p className="text-slate-500 text-sm line-clamp-2 mt-1 mb-3 flex-1">
          {item.description}
        </p>

        <div className="pt-3 border-t border-slate-100 flex items-center justify-between text-xs text-slate-400">
          <span>Agent: {item.agent_name || 'Rumia Agent'}</span>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleCompare}
              className={`inline-flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-bold transition-all duration-200 cursor-pointer ${
                isSelected
                  ? 'bg-emerald-600 text-white shadow-sm shadow-emerald-600/20'
                  : 'bg-slate-900 text-white hover:bg-slate-700'
              }`}
            >
              {isSelected ? (
                <>
                  <Check className="h-3.5 w-3.5" />
                  Added
                </>
              ) : (
                <>
                  <GitCompareArrows className="h-3.5 w-3.5" />
                  Compare
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </Link>
  );
}

export function PopularHostels({ listings }: { listings: PopularListing[] }) {
  const campus = useCampus();
  if (listings.length === 0) return null;

  return (
    <section className="container mx-auto px-4 py-10 sm:py-14">
      <div className="flex items-end justify-between mb-6">
        <div>
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-50 border border-amber-200/60 text-amber-700 text-xs font-bold mb-3">
            <TrendingUp className="h-3 w-3" />
            Trending
          </div>
          <h2 className="text-2xl sm:text-4xl font-extrabold tracking-tight text-slate-950">
            Popular on Rumia
          </h2>
          <p className="text-slate-500 mt-2 font-medium">
            The most visited hostels by {campus.short_name ?? 'DeKUT'} students of all time.
          </p>
        </div>
        <Link
          href="/hostels"
          className="group hidden sm:flex items-center text-sm font-semibold text-emerald-600 hover:text-emerald-500 transition-colors"
        >
          View all
          <ArrowRight className="ml-1 h-4 w-4 group-hover:translate-x-0.5 transition-transform" />
        </Link>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
        {listings.map((item, index) => (
          <PopularCard key={item.id} item={item} index={index} />
        ))}
      </div>

      <div className="mt-10 text-center sm:hidden">
        <Link
          href="/hostels"
          className="inline-flex items-center gap-2 px-5 py-3 rounded-xl bg-emerald-600 text-white font-semibold text-sm hover:bg-emerald-500 transition-colors"
        >
          View All Listings
          <ArrowRight className="h-4 w-4" />
        </Link>
      </div>
    </section>
  );
}
