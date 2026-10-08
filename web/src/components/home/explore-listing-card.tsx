'use client';

import Image from 'next/image';
import Link from 'next/link';
import { MapPin, BadgeCheck } from 'lucide-react';
import { SaveButton } from '@/components/ui/save-button';
import { NoPhotoTile } from '@/components/ui/no-photo-tile';
import { formatCurrency } from '@/lib/utils/currency';
import { getDistanceBadgeText } from '@/lib/constants/dekut-areas';
import type { PropertyType } from '@/types';

export interface ExploreListing {
  id: string;
  title: string;
  price: number;
  location: string;
  slug?: string | null;
  county?: string | null;
  area?: string | null;
  property_type?: PropertyType | string | null;
  distance_category?: string | null;
  room_type?: string | null;
  bathroom_type?: string | null;
  wifi_included?: boolean | null;
  rating?: number | null;
  views?: number | null;
  created_at?: string | null;
  image_url?: string | null;
  blur_data_url?: string | null;
  verified?: boolean | null;
}

export function propertyTypeLabel(v?: PropertyType | string | null): string {
  if (v === 'apartment') return 'Apartment';
  if (v === 'short_stay') return 'Short stay';
  return 'Hostel';
}

export function pricePeriod(v?: PropertyType | string | null): string {
  return v === 'short_stay' ? '/ night' : '/ month';
}

export function ExploreListingCard({ item }: { item: ExploreListing }) {
  const type = (item.property_type ?? 'hostel') as PropertyType;
  const href =
    type === 'short_stay'
      ? `/bnb/${item.id}`
      : item.slug
        ? `/hostels/${item.county || 'nyeri'}/${item.area || 'dekut'}/${item.slug}`
        : `/listing/${item.id}`;
  const distance = item.distance_category
    ? getDistanceBadgeText(item.distance_category)
    : null;

  return (
    <Link
      href={href}
      className="group w-[calc((100vw-64px)/2)] min-w-[144px] shrink-0 snap-start rounded-2xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600 focus-visible:ring-offset-2 sm:w-[248px]"
    >
      <div className="relative aspect-[4/3] overflow-hidden rounded-2xl bg-slate-100 ring-1 ring-slate-900/[0.04]">
        {item.image_url ? (
          <Image
            src={item.image_url}
            alt={item.title}
            fill
            sizes="248px"
            className="object-cover transition-transform duration-300 group-hover:scale-[1.02]"
            placeholder={item.blur_data_url ? 'blur' : undefined}
            blurDataURL={item.blur_data_url || undefined}
          />
        ) : (
          <NoPhotoTile />
        )}
        <div className="absolute left-2.5 top-2.5 rounded-full bg-white px-2.5 py-1 text-[10px] font-semibold tracking-wide text-slate-800 shadow-sm ring-1 ring-slate-900/5">
          {propertyTypeLabel(type)}
        </div>
        {item.verified && (
          <div className="absolute bottom-2 left-2 inline-flex items-center gap-1 rounded-full bg-emerald-600 px-2 py-1 text-[10px] font-bold text-white shadow-sm">
            <BadgeCheck className="h-3 w-3" /> Verified
          </div>
        )}
        <div className="absolute right-2 top-2 z-10">
          <SaveButton
            listingId={String(item.id)}
            variant="icon"
            className="h-9 w-9 border-white/60 shadow-sm backdrop-blur-none bg-white"
          />
        </div>
      </div>

      <div className="px-0.5 pt-2.5">
        <h3 className="text-[15px] font-bold leading-6 text-slate-900 group-hover:text-emerald-700">
          {item.title}
        </h3>
        <div className="mt-2 flex items-start gap-1 text-[13px] leading-5 text-slate-500">
          <MapPin
            className="h-3.5 w-3.5 shrink-0 text-slate-400"
            strokeWidth={1.9}
          />
          <span>
            {item.area || item.location || 'Nyeri'}
            {distance ? ` · ${distance}` : ''}
          </span>
        </div>
        <p className="mt-2 text-base font-extrabold leading-6 tracking-tight text-slate-900">
          {formatCurrency(item.price)}
          <span className="ml-1 text-xs font-medium text-slate-500">
            {pricePeriod(type)}
          </span>
        </p>
      </div>
    </Link>
  );
}
