'use client';

import Image from 'next/image';
import Link from 'next/link';
import { MapPin } from 'lucide-react';
import { SaveButton } from '@/components/ui/save-button';
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
}

const EXPLORE_FALLBACK_IMAGE =
  'https://images.unsplash.com/photo-1555854877-bab0e564b8d5?q=80&w=600';

export function propertyTypeLabel(
  propertyType?: PropertyType | string | null,
): string {
  switch (propertyType) {
    case 'apartment':
      return 'Apartment';
    case 'short_stay':
      return 'Short stay';
    case 'hostel':
    default:
      return 'Hostel';
  }
}

export function pricePeriod(propertyType?: PropertyType | string | null): string {
  return propertyType === 'short_stay' ? '/ night' : '/ month';
}

export function ExploreListingCard({ item }: { item: ExploreListing }) {
  const type = (item.property_type ?? 'hostel') as PropertyType;
  const href = item.slug
    ? `/hostels/${item.county || 'nyeri'}/${item.area || 'dekut'}/${item.slug}`
    : `/listing/${item.id}`;

  const distanceText = item.distance_category
    ? getDistanceBadgeText(item.distance_category)
    : null;

  return (
    <Link
      href={href}
      className="group block w-[230px] xs:w-[250px] sm:w-[264px] shrink-0 snap-start focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600 focus-visible:ring-offset-2 rounded-2xl touch-manipulation"
    >
      <div className="relative aspect-[4/3] w-full overflow-hidden rounded-2xl bg-slate-100 ring-1 ring-slate-900/5">
        <Image
          src={item.image_url || EXPLORE_FALLBACK_IMAGE}
          alt={item.title}
          fill
          loading="lazy"
          sizes="(max-width: 480px) 230px, (max-width: 640px) 250px, 264px"
          className="object-cover md:transition-transform md:duration-300 md:ease-out md:group-hover:scale-105"
          placeholder={item.blur_data_url ? 'blur' : undefined}
          blurDataURL={item.blur_data_url || undefined}
        />

        <div className="absolute left-2.5 top-2.5 rounded-lg bg-white px-2.5 py-1 text-[11px] font-bold text-slate-800 shadow-xs border border-slate-100">
          {propertyTypeLabel(type)}
        </div>

        <div
          className="absolute right-1.5 top-1.5 p-1 touch-manipulation"
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
          }}
        >
          <SaveButton
            listingId={String(item.id)}
            variant="icon"
            className="h-8.5 w-8.5 shadow-xs"
          />
        </div>
      </div>

      <div className="px-1 pt-2 sm:pt-2.5">
        <h3 className="truncate text-sm sm:text-[15px] font-bold text-slate-900 transition-colors group-hover:text-emerald-700">
          {item.title}
        </h3>
        <div className="mt-0.5 sm:mt-1 flex items-center justify-between gap-1 text-xs font-medium text-slate-500">
          <div className="flex items-center gap-1 min-w-0">
            <MapPin className="h-3.5 w-3.5 shrink-0 text-slate-400" />
            <span className="truncate">
              {item.location || item.area || 'Nyeri'}
              {distanceText ? ` · ${distanceText}` : ''}
            </span>
          </div>
          {typeof item.rating === 'number' && item.rating > 0 && (
            <span className="shrink-0 font-bold text-amber-600">
              ★ {item.rating.toFixed(1)}
            </span>
          )}
        </div>
        <p className="mt-1 sm:mt-1.5 text-sm sm:text-[15px] font-extrabold text-slate-900">
          {formatCurrency(item.price)}
          <span className="ml-1 text-xs font-normal text-slate-500">{pricePeriod(type)}</span>
        </p>
      </div>
    </Link>
  );
}