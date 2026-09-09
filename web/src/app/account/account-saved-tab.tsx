'use client';

import { useEffect, useState, useMemo } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { apiClient } from '@/lib/api/client';
import {
  Heart,
  MapPin,
  ArrowRight,
  ArrowLeft,
  Loader2,
  GitCompareArrows,
  CalendarPlus,
  Trash2,
  Check,
  X,
  Navigation,
  Wifi,
  Droplets,
  Zap,
  ShieldCheck,
  BedDouble,
  Users,
} from 'lucide-react';
import { useCompareStore, type CompareSelection } from '@/stores/compare-store';
import { getDistanceBadgeText } from '@/lib/constants/dekut-areas';

interface SavedListing {
  id: string; // listing id (FastAPI /profiles/me/wishlist is authoritative)
  listing_id: string;
  created_at: string;
  listings: {
    id: string;
    title: string;
    price: number;
    price_single?: number | null;
    price_sharing?: number | null;
    location: string;
    slug: string;
    county: string;
    area: string;
    room_type?: string | null;
    bathroom_type?: string | null;
    distance_category?: string | null;
    distance_to_campus?: string | null;
    gender?: string | null;
    wifi_included?: boolean | null;
    water_included?: boolean | null;
    electricity_included?: boolean | null;
    security_type?: string | null;
    amenities?: string[] | null;
    listing_images: { r2_url: string; display_order: number; blur_data_url?: string }[];
  } | null;
}

interface ApiSavedImage {
  r2_url: string;
  display_order: number;
  blur_data_url?: string | null;
}

// Shape of a listing as returned by GET /profiles/me/wishlist (ListingRead).
interface ApiSavedListing {
  id: string;
  title: string;
  price: number;
  price_single?: number | null;
  price_sharing?: number | null;
  location: string;
  slug?: string | null;
  county?: string | null;
  area?: string | null;
  room_type?: string | null;
  bathroom_type?: string | null;
  distance_category?: string | null;
  distance_to_campus?: string | null;
  gender?: string | null;
  wifi_included?: boolean;
  water_included?: boolean;
  electricity_included?: boolean;
  security_type?: string | null;
  amenities?: string[] | null;
  images: ApiSavedImage[];
  created_at: string;
}

interface ApiSavedResponse {
  items: ApiSavedListing[];
  total: number;
}

function toSavedListing(l: ApiSavedListing): SavedListing {
  const listing: SavedListing['listings'] = {
    id: l.id,
    title: l.title,
    price: l.price,
    price_single: l.price_single,
    price_sharing: l.price_sharing,
    location: l.location,
    slug: l.slug ?? '',
    county: l.county ?? '',
    area: l.area ?? '',
    room_type: l.room_type,
    bathroom_type: l.bathroom_type,
    distance_category: l.distance_category,
    distance_to_campus: l.distance_to_campus,
    gender: l.gender,
    wifi_included: l.wifi_included,
    water_included: l.water_included,
    electricity_included: l.electricity_included,
    security_type: l.security_type,
    amenities: l.amenities,
    listing_images: l.images.map((img) => ({
      r2_url: img.r2_url,
      display_order: img.display_order,
      blur_data_url: img.blur_data_url ?? undefined,
    })),
  };
  return {
    id: l.id,
    listing_id: l.id,
    created_at: l.created_at,
    listings: listing,
  };
}

interface AccountSavedTabProps {
  onBackToOverview?: () => void;
}

export function AccountSavedTab({ onBackToOverview }: AccountSavedTabProps) {
  const [saved, setSaved] = useState<SavedListing[]>([]);
  const [loading, setLoading] = useState(true);
  const [removingId, setRemovingId] = useState<string | null>(null);
  const [compareMode, setCompareMode] = useState(false);

  // Compare store integration
  const {
    selectedIds,
    selections,
    addSelection,
    removeSelection,
    clearSelection,
    loadFromIds,
    hydrateFromStorage,
  } = useCompareStore();

  useEffect(() => {
    hydrateFromStorage();
  }, [hydrateFromStorage]);

  useEffect(() => {
    let cancelled = false;

    async function fetchSaved() {
      try {
        const res = await apiClient<ApiSavedResponse>('/profiles/me/wishlist?limit=100');
        if (cancelled) return;
        const validData = res.items.map(toSavedListing).filter((item) => item.listings);
        setSaved(validData);

        // Pre-populate selections for compare store from saved listings if available
        const remoteSelections: Record<string, CompareSelection> = {};
        validData.forEach((item) => {
          if (item.listings) {
            const l = item.listings;
            const img = l.listing_images?.sort((a, b) => a.display_order - b.display_order)[0];
            remoteSelections[l.id] = {
              id: l.id,
              title: l.title,
              price: l.price,
              price_single: l.price_single,
              price_sharing: l.price_sharing,
              imageUrl: img?.r2_url,
              slug: l.slug,
              county: l.county,
              area: l.area,
              roomType: l.room_type,
              bathroomType: l.bathroom_type,
              distanceCategory: l.distance_category,
              distanceToCampus: l.distance_to_campus,
              gender: l.gender,
              wifiIncluded: l.wifi_included,
              waterIncluded: l.water_included,
              electricityIncluded: l.electricity_included,
              securityType: l.security_type,
              amenities: l.amenities,
            };
          }
        });

        // Sync selected items if compare store already has selected IDs
        if (selectedIds.length > 0) {
          loadFromIds(selectedIds, remoteSelections);
        }
      } catch {
        // Error fetching wishlist — leave the tab empty.
      }
      setLoading(false);
    }

    fetchSaved();
    return () => {
      cancelled = true;
    };
  }, [loadFromIds, selectedIds]);

  async function handleUnsave(_savedId: string, listingId: string) {
    setRemovingId(listingId);
    try {
      await apiClient(`/profiles/me/wishlist/${listingId}`, { method: 'DELETE' });
      setSaved((prev) => prev.filter((s) => s.listing_id !== listingId));
      removeSelection(listingId);
    } catch {
      // Failed to remove from wishlist remotely — keep the item.
    }
    setRemovingId(null);
  }

  const toggleSelectForCompare = (listing: SavedListing['listings']) => {
    if (!listing) return;
    if (selectedIds.includes(listing.id)) {
      removeSelection(listing.id);
    } else {
      const img = listing.listing_images?.sort((a, b) => a.display_order - b.display_order)[0];
      addSelection({
        id: listing.id,
        title: listing.title,
        price: listing.price,
        price_single: listing.price_single,
        price_sharing: listing.price_sharing,
        imageUrl: img?.r2_url,
        slug: listing.slug,
        county: listing.county,
        area: listing.area,
        roomType: listing.room_type,
        bathroomType: listing.bathroom_type,
        distanceCategory: listing.distance_category,
        distanceToCampus: listing.distance_to_campus,
        gender: listing.gender,
        wifiIncluded: listing.wifi_included,
        waterIncluded: listing.water_included,
        electricityIncluded: listing.electricity_included,
        securityType: listing.security_type,
        amenities: listing.amenities,
      });
    }
  };

  const selectedHostelsToCompare = useMemo(() => {
    return selectedIds
      .map((id) => selections[id])
      .filter((sel): sel is CompareSelection => Boolean(sel));
  }, [selectedIds, selections]);

  if (loading) {
    return (
      <div className="space-y-6" role="status" aria-live="polite" aria-busy="true">
        <div className="flex items-center justify-between">
          <div className="skeleton h-4 w-32" />
          <div className="skeleton h-9 w-24 rounded-xl" />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="skeleton aspect-4/3 rounded-2xl" />
          ))}
        </div>
        <span className="sr-only">Loading your wishlist</span>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Back Button & Header */}
      <div className="flex items-center justify-between">
        {onBackToOverview ? (
          <button
            onClick={onBackToOverview}
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-600 hover:text-slate-900 transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to Overview
          </button>
        ) : (
          <Link
            href="/account?tab=overview"
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-600 hover:text-slate-900 transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to Overview
          </Link>
        )}

        <Link
          href="/hostels"
          className="inline-flex items-center gap-1 h-9 px-3.5 rounded-xl bg-white border border-slate-200 text-slate-700 text-xs font-semibold hover:bg-slate-100 transition-colors"
        >
          Continue Browsing
          <ArrowRight className="h-3.5 w-3.5" />
        </Link>
      </div>

      {/* Header Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-slate-50 border border-slate-200/80 rounded-2xl p-4 sm:px-6">
        <div>
          <h2 className="text-base font-bold text-slate-900">
            {saved.length} in wishlist
          </h2>
          <p className="text-xs text-slate-500">
            Select hostels below to compare prices, amenities, and locations side-by-side.
          </p>
        </div>

        {selectedIds.length >= 2 && (
          <button
            onClick={() => setCompareMode(!compareMode)}
            className={`inline-flex items-center gap-1.5 h-9 px-3.5 rounded-xl text-xs font-semibold transition-colors shrink-0 ${
              compareMode
                ? 'bg-emerald-600 text-white hover:bg-emerald-700'
                : 'bg-white border border-slate-200 text-slate-800 hover:bg-slate-100'
            }`}
          >
            <GitCompareArrows className="h-3.5 w-3.5" />
            {compareMode ? 'Back to Wishlist' : `Compare Selected (${selectedIds.length})`}
          </button>
        )}
      </div>

      {/* Empty State */}
      {saved.length === 0 ? (
        <div className="text-center py-16 bg-white border border-slate-200/80 rounded-2xl p-6">
          <div className="w-12 h-12 rounded-full bg-rose-50 text-rose-500 flex items-center justify-center mx-auto mb-3">
            <Heart className="h-6 w-6" />
          </div>
          <h3 className="text-base font-bold text-slate-900 mb-1">No wishlist items yet</h3>
          <p className="text-sm text-slate-500 mb-6 max-w-sm mx-auto">
            Tap the heart icon on any hostel listing to add it to your wishlist for quick access and side-by-side comparison.
          </p>
          <Link
            href="/hostels"
            className="inline-flex items-center gap-2 h-10 px-5 rounded-xl bg-slate-900 text-white text-xs font-semibold hover:bg-slate-800 transition-colors shadow-sm"
          >
            Continue Browsing Hostels
            <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      ) : null}

      {/* Compare View Section */}
      {compareMode && selectedHostelsToCompare.length >= 2 ? (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-slate-900">
              Side-by-Side Comparison ({selectedHostelsToCompare.length} hostels)
            </h3>
            <button
              onClick={clearSelection}
              className="text-xs font-semibold text-slate-500 hover:text-red-600 transition-colors"
            >
              Clear comparison
            </button>
          </div>

          {/* Integrated Side-by-Side Table */}
          <div className="border border-slate-200/80 rounded-2xl bg-white overflow-hidden overflow-x-auto">
            <table className="w-full text-left border-collapse min-w-[600px]">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50">
                  <th className="p-3 sm:p-4 text-xs font-semibold text-slate-500 uppercase tracking-wider w-36">
                    Feature
                  </th>
                  {selectedHostelsToCompare.map((item) => {
                    const href = item.slug
                      ? `/hostels/${item.county || 'nyeri'}/${item.area || 'dekut'}/${item.slug}`
                      : `/listing/${item.id}`;
                    return (
                      <th key={item.id} className="p-3 sm:p-4 min-w-[200px]">
                        <div className="space-y-2">
                          <Link href={href} className="block group">
                            <div className="w-full aspect-[16/10] rounded-lg bg-slate-100 overflow-hidden mb-2 relative">
                              {item.imageUrl ? (
                                <Image
                                  src={item.imageUrl}
                                  alt={item.title}
                                  fill
                                  sizes="(min-width: 768px) 25vw, 100vw"
                                  className="object-cover group-hover:scale-105 transition-transform"
                                />
                              ) : (
                                <div className="w-full h-full bg-slate-100" />
                              )}
                            </div>
                            <p className="text-xs font-bold text-slate-900 group-hover:text-emerald-700 truncate">
                              {item.title}
                            </p>
                          </Link>
                          <div className="flex items-center gap-1 text-[11px] font-bold text-slate-900">
                            KES {(item.price_single || item.price).toLocaleString()}/mo
                          </div>
                          <div className="flex items-center gap-1.5 pt-1">
                            <Link
                              href={`/account/book-tour?listingId=${item.id}`}
                              className="inline-flex items-center justify-center gap-1 flex-1 h-7 rounded-lg bg-slate-900 text-white text-[10px] font-semibold hover:bg-slate-800 transition-colors"
                            >
                              <CalendarPlus className="h-3 w-3" />
                              Book Tour
                            </Link>
                            <button
                              onClick={() => removeSelection(item.id)}
                              className="p-1 rounded-lg text-slate-400 hover:text-red-600 hover:bg-slate-100"
                              title="Remove from comparison"
                            >
                              <X className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        </div>
                      </th>
                    );
                  })}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-xs">
                {/* Room Type */}
                <tr>
                  <td className="p-3 font-semibold text-slate-500 flex items-center gap-1.5">
                    <BedDouble className="h-3.5 w-3.5 text-slate-400" />
                    Room Type
                  </td>
                  {selectedHostelsToCompare.map((item) => (
                    <td key={item.id} className="p-3 text-slate-700 font-medium">
                      {item.roomType || 'Standard'}
                    </td>
                  ))}
                </tr>

                {/* Distance */}
                <tr>
                  <td className="p-3 font-semibold text-slate-500 flex items-center gap-1.5">
                    <Navigation className="h-3.5 w-3.5 text-slate-400" />
                    Distance
                  </td>
                  {selectedHostelsToCompare.map((item) => (
                    <td key={item.id} className="p-3 text-slate-700 font-medium">
                      {getDistanceBadgeText(item.distanceCategory) || item.distanceToCampus || '—'}
                    </td>
                  ))}
                </tr>

                {/* WiFi */}
                <tr>
                  <td className="p-3 font-semibold text-slate-500 flex items-center gap-1.5">
                    <Wifi className="h-3.5 w-3.5 text-slate-400" />
                    WiFi
                  </td>
                  {selectedHostelsToCompare.map((item) => (
                    <td key={item.id} className="p-3">
                      {item.wifiIncluded ? (
                        <span className="inline-flex items-center gap-1 text-emerald-600 font-semibold">
                          <Check className="h-3.5 w-3.5" /> Included
                        </span>
                      ) : (
                        <span className="text-slate-400">Not included</span>
                      )}
                    </td>
                  ))}
                </tr>

                {/* Water */}
                <tr>
                  <td className="p-3 font-semibold text-slate-500 flex items-center gap-1.5">
                    <Droplets className="h-3.5 w-3.5 text-slate-400" />
                    Water
                  </td>
                  {selectedHostelsToCompare.map((item) => (
                    <td key={item.id} className="p-3">
                      {item.waterIncluded ? (
                        <span className="inline-flex items-center gap-1 text-emerald-600 font-semibold">
                          <Check className="h-3.5 w-3.5" /> Included
                        </span>
                      ) : (
                        <span className="text-slate-400">Tokens/Extra</span>
                      )}
                    </td>
                  ))}
                </tr>

                {/* Electricity */}
                <tr>
                  <td className="p-3 font-semibold text-slate-500 flex items-center gap-1.5">
                    <Zap className="h-3.5 w-3.5 text-slate-400" />
                    Electricity
                  </td>
                  {selectedHostelsToCompare.map((item) => (
                    <td key={item.id} className="p-3">
                      {item.electricityIncluded ? (
                        <span className="inline-flex items-center gap-1 text-emerald-600 font-semibold">
                          <Check className="h-3.5 w-3.5" /> Included
                        </span>
                      ) : (
                        <span className="text-slate-400">Token Meter</span>
                      )}
                    </td>
                  ))}
                </tr>

                {/* Security */}
                <tr>
                  <td className="p-3 font-semibold text-slate-500 flex items-center gap-1.5">
                    <ShieldCheck className="h-3.5 w-3.5 text-slate-400" />
                    Security
                  </td>
                  {selectedHostelsToCompare.map((item) => (
                    <td key={item.id} className="p-3 text-slate-700 capitalize font-medium">
                      {item.securityType || 'Standard'}
                    </td>
                  ))}
                </tr>

                {/* Gender */}
                <tr>
                  <td className="p-3 font-semibold text-slate-500 flex items-center gap-1.5">
                    <Users className="h-3.5 w-3.5 text-slate-400" />
                    Gender
                  </td>
                  {selectedHostelsToCompare.map((item) => (
                    <td key={item.id} className="p-3 text-slate-700 capitalize font-medium">
                      {item.gender === 'female'
                        ? 'Ladies Only'
                        : item.gender === 'male'
                          ? 'Gents Only'
                          : 'Mixed'}
                    </td>
                  ))}
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      ) : null}

      {/* Wishlist */}
      {saved.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center justify-between px-1">
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
              Wishlist
            </p>
            {selectedIds.length > 0 && (
              <span className="text-xs text-slate-500 font-medium">
                {selectedIds.length} selected for comparison
              </span>
            )}
          </div>

          <div className="border border-slate-200/80 rounded-2xl bg-white overflow-hidden divide-y divide-slate-100">
            {saved.map((item) => {
              const listing = item.listings;
              if (!listing) return null;

              const image = listing.listing_images?.sort(
                (a, b) => a.display_order - b.display_order,
              )[0];

              const href = listing.slug
                ? `/hostels/${listing.county || 'nyeri'}/${listing.area || 'dekut'}/${listing.slug}`
                : `/listing/${listing.id}`;

              const isSelectedForCompare = selectedIds.includes(listing.id);

              return (
                <div
                  key={item.id}
                  className="flex flex-col sm:flex-row sm:items-center justify-between p-4 gap-4 hover:bg-slate-50/80 transition-colors"
                >
                  <div className="flex items-center gap-3.5 min-w-0">
                    {/* Select for Compare Checkbox */}
                    <input
                      type="checkbox"
                      checked={isSelectedForCompare}
                      onChange={() => toggleSelectForCompare(listing)}
                      title="Select to compare side-by-side"
                      className="h-4 w-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500 cursor-pointer shrink-0"
                    />

                    {/* Image */}
                    <Link
                      href={href}
                      className="w-16 h-16 rounded-xl bg-slate-100 overflow-hidden shrink-0 block relative border border-slate-200/60"
                    >
                      {image ? (
                        <Image
                          src={image.r2_url}
                          alt={listing.title}
                          width={64}
                          height={64}
                          className="w-full h-full object-cover"
                          placeholder={image.blur_data_url ? 'blur' : undefined}
                          blurDataURL={image.blur_data_url || undefined}
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center">
                          <Heart className="h-4 w-4 text-slate-300" />
                        </div>
                      )}
                    </Link>

                    {/* Title & Location */}
                    <div className="min-w-0 flex-1 space-y-0.5">
                      <Link href={href} className="block min-w-0">
                        <p className="text-sm font-bold text-slate-900 truncate hover:text-emerald-700 transition-colors">
                          {listing.title}
                        </p>
                      </Link>
                      <p className="flex items-center gap-1 text-xs text-slate-500">
                        <MapPin className="h-3 w-3 shrink-0 text-slate-400" />
                        <span className="truncate">{listing.location}</span>
                      </p>
                      <div className="flex items-center gap-2 pt-1 text-xs font-bold text-slate-900 tabular-nums sm:hidden">
                        KES {listing.price.toLocaleString()}/mo
                      </div>
                    </div>
                  </div>

                  {/* Right Actions */}
                  <div className="flex items-center justify-between sm:justify-end gap-3 shrink-0 pt-2 sm:pt-0 border-t sm:border-t-0 border-slate-100">
                    <span className="text-sm font-bold text-slate-900 tabular-nums hidden sm:block">
                      KES {listing.price.toLocaleString()}/mo
                    </span>

                    <div className="flex items-center gap-2 w-full sm:w-auto">
                      <Link
                        href={`/account/book-tour?listingId=${listing.id}`}
                        className="inline-flex items-center justify-center gap-1.5 h-8 px-3 rounded-lg bg-slate-900 text-white text-xs font-semibold hover:bg-slate-800 transition-colors shrink-0"
                      >
                        <CalendarPlus className="h-3.5 w-3.5" />
                        Book Tour
                      </Link>

                      <button
                        onClick={() => handleUnsave(item.id, listing.id)}
                        disabled={removingId === item.id}
                        className="inline-flex items-center justify-center gap-1 h-8 px-2.5 rounded-lg border border-slate-200 text-slate-500 hover:text-red-600 hover:bg-red-50 hover:border-red-200 text-xs font-semibold transition-colors disabled:opacity-50"
                        title="Remove from wishlist"
                      >
                        {removingId === item.id ? (
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        ) : (
                          <Trash2 className="h-3.5 w-3.5" />
                        )}
                        <span className="hidden md:inline">Remove</span>
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
