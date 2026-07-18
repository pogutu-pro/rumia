'use client';

import { useEffect, useCallback } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { MapPin, ArrowRight, GitCompareArrows, Check } from 'lucide-react';
import { toast } from 'sonner';
import { useCompareStore } from '@/stores/compare-store';

export interface DeKutListing {
  id: string;
  title: string;
  description: string;
  price: number;
  location: string;
  slug: string | null;
  county: string | null;
  area: string | null;
  gender?: 'mixed' | 'male' | 'female' | null;
  specific_location?: string | null;
  price_single?: number | null;
  price_sharing?: number | null;
  distance_category?: string | null;
  distance_to_campus?: string | null;
  mpesa_details?: string | null;
  amenities?: string[] | null;
  room_type?: string | null;
  room_type_enum?: string | null;
  bathroom_type?: string | null;
  wifi_included?: boolean | null;
  water_included?: boolean | null;
  electricity_included?: boolean | null;
  security_type?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  listing_images: { r2_url: string; display_order: number; blur_data_url?: string }[];
  agents: { name: string; phone?: string; whatsapp?: string } | null;
  listing_room_types?: { deposit?: number | null; furnishing_items?: string[] | null; label?: string | null }[] | null;
}

export default function DeKutCompareGrid({ listings }: { listings: DeKutListing[] }) {
  const hydrateCompare = useCompareStore((s) => s.hydrateFromStorage);
  const compareSelectedIds = useCompareStore((s) => s.selectedIds);
  const addCompareSelection = useCompareStore((s) => s.addSelection);
  const removeCompareSelection = useCompareStore((s) => s.removeSelection);
  const isCompareSelected = useCompareStore((s) => s.isSelected);

  useEffect(() => {
    hydrateCompare();
  }, [hydrateCompare]);

  const handleCompareToggle = useCallback(
    (item: DeKutListing) => {
      const sorted = [...(item.listing_images || [])].sort(
        (a, b) => a.display_order - b.display_order,
      );
      const imageUrl = sorted[0]?.r2_url;
      const roomTypes = item.listing_room_types || [];
      const firstRoom = roomTypes[0] || {};

      if (isCompareSelected(item.id)) {
        removeCompareSelection(item.id);
        toast.info(`${item.title} removed from comparison`);
        return;
      }

      const result = addCompareSelection({
        id: item.id,
        title: item.title,
        price: item.price,
        price_single: item.price_single,
        price_sharing: item.price_sharing,
        imageUrl,
        slug: item.slug,
        county: item.county,
        area: item.area,
        agentName: item.agents?.name ?? null,
        agentPhone: item.agents?.phone ?? null,
        agentWhatsapp: item.agents?.whatsapp ?? null,
        amenities: item.amenities,
        roomType: item.room_type,
        roomTypeEnum: item.room_type_enum,
        bathroomType: item.bathroom_type,
        distanceCategory: item.distance_category,
        distanceToCampus: item.distance_to_campus,
        gender: item.gender,
        wifiIncluded: item.wifi_included,
        waterIncluded: item.water_included,
        electricityIncluded: item.electricity_included,
        securityType: item.security_type,
        specificLocation: item.specific_location,
        latitude: item.latitude,
        longitude: item.longitude,
        mpesaDetails: item.mpesa_details,
        deposit: firstRoom.deposit ?? null,
        furnishingItems: firstRoom.furnishing_items ?? null,
        roomTypeLabel: firstRoom.label ?? null,
      });

      if (result.ok) {
        const currentCount = compareSelectedIds.length + 1;
        if (currentCount === 1) {
          toast.success(`${item.title} added to comparison`, {
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
    [addCompareSelection, removeCompareSelection, isCompareSelected, compareSelectedIds.length],
  );

  return (
    <>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
        {listings.map((item) => {
          const sortedImages = (item.listing_images || []).sort(
            (a: any, b: any) => a.display_order - b.display_order,
          );
          const imageUrl =
            sortedImages[0]?.r2_url ??
            'https://images.unsplash.com/photo-1555854877-bab0e564b8d5?q=80&w=600';
          const blurDataUrl = sortedImages[0]?.blur_data_url;
          const href = item.slug
            ? `/hostels/${item.county || 'nyeri'}/${item.area || 'dekut'}/${item.slug}`
            : `/listing/${item.id}`;
          const isSelected = isCompareSelected(item.id);

          return (
            <div key={item.id} className="relative group/card">
              <Link
                href={href}
                className={`group flex flex-col bg-white rounded-2xl overflow-hidden hover:shadow-lg transition-all duration-300 h-full ${
                  isSelected
                    ? 'border-2 border-emerald-400 shadow-md shadow-emerald-100'
                    : 'border border-slate-100'
                }`}
              >
                <div className="relative aspect-4/3 overflow-hidden bg-slate-100">
                  <Image
                    src={imageUrl}
                    alt={`${item.title} — student hostel near DeKUT Nyeri`}
                    fill
                    className="object-cover transition-transform duration-500 group-hover:scale-105"
                    sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
                    placeholder={blurDataUrl ? 'blur' : undefined}
                    blurDataURL={blurDataUrl || undefined}
                  />
                  <div className="absolute top-3 right-3 bg-white/95 backdrop-blur-sm px-2.5 py-1 rounded-lg text-xs font-bold shadow-sm text-slate-900 border border-slate-100/50">
                    KES {item.price.toLocaleString()}/mo
                  </div>
                </div>

                <div className="p-4 flex-1 flex flex-col">
                  <div className="flex items-center gap-1 text-slate-400 text-xs font-semibold mb-1 uppercase tracking-wider">
                    <MapPin className="h-3 w-3 shrink-0" />
                    <span className="truncate">{item.location}</span>
                  </div>
                  <h3 className="font-bold text-slate-900 line-clamp-1 group-hover:text-emerald-600 transition-colors">
                    {item.title}
                  </h3>
                  <p className="text-slate-500 text-xs line-clamp-2 mt-1 mb-4 flex-1">
                    {item.description}
                  </p>
                  <div className="pt-3 border-t border-slate-100 flex items-center justify-between text-xs text-slate-400">
                    <span>Agent: {item.agents?.name || 'Rumia Agent'}</span>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          handleCompareToggle(item);
                        }}
                        className="inline-flex items-center gap-1 rounded-lg bg-slate-900 px-2.5 py-1 text-[11px] font-bold text-white transition-all duration-200 cursor-pointer hover:bg-slate-700"
                      >
                        {isSelected ? (
                          <>
                            <Check className="h-3 w-3" />
                            Added
                          </>
                        ) : (
                          <>
                            <GitCompareArrows className="h-3 w-3" />
                            Compare
                          </>
                        )}
                      </button>
                      <span className="font-semibold text-emerald-600 flex items-center gap-0.5">
                        View Details <ArrowRight className="h-3 w-3" />
                      </span>
                    </div>
                  </div>
                </div>
              </Link>
            </div>
          );
        })}
      </div>
    </>
  );
}
