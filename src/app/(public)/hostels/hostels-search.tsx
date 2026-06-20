'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import { Search, MapPin, X, Eye } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { createClient } from '@/lib/supabase/client';
import { useDebounce } from '@/hooks/use-debounce';
import { getDistanceBadgeText } from '@/lib/constants/dekut-areas';
import { EarlyAccessBanner } from '@/components/feedback/early-access-banner';

// ── Types ─────────────────────────────────────────────────────────────────────

interface ParsedFilters {
  maxPrice?: number;
  exactPrice?: number;
  gender?: 'male' | 'female';
  roomType?: string;
  amenities: string[];
  area?: string;
  proximityGate?: 'A' | 'B';
  sortByProximity: boolean;
  freeText: string;
}

interface ActiveTag {
  label: string;
  removeWord: string;
}

export interface Listing {
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
  listing_images: { r2_url: string; display_order: number }[];
  agents: { name: string } | null;
}

// ── Keyword Parser ─────────────────────────────────────────────────────────────

const PRICE_WORDS = ['cheap', 'affordable', 'budget'];
const GENDER_FEMALE = ['ladies', 'girls', 'female'];
const GENDER_MALE = ['gents', 'boys', 'male'];
const AREA_KEYWORDS: [string[], string][] = [
  [['near gate a', 'gate a'], 'Near Gate A'],
  [['near gate b', 'gate b'], 'Near Gate B'],
  [['near gate c', 'gate c', 'boma'], 'Near Gate C (Boma)'],
  [['nyeri view'], 'Nyeri View'],
  [['kahawa ridge'], 'Kahawa Ridge'],
  [['embassy'], 'Embassy Area'],
  [['nyaribo'], 'Nyaribo'],
];
const ROOM_TYPES: [string[], string][] = [
  [['self contained', 'ensuite'], 'self_contained'],
  [['bedsitter', 'bed sitter'], 'bedsitter'],
  [['single room', 'single'], 'single'],
  [['double room', 'double'], 'double'],
  [['shared'], 'shared'],
];
const AMENITY_MAP: [string[], string][] = [
  [['wifi', 'internet'], 'WiFi'],
  [['water'], 'Water'],
  [['electricity', 'power'], 'Electricity'],
  [['parking'], 'Parking'],
  [['security', 'guard'], 'Security'],
  [['furnished'], 'Furnished'],
  [['washing', 'laundry'], 'Laundry Area'],
];

function parseQuery(input: string): ParsedFilters {
  const lower = input.toLowerCase();
  const filters: ParsedFilters = {
    amenities: [],
    sortByProximity: false,
    freeText: '',
  };
  let remaining = lower;

  // Price: cheap / affordable / budget → max 5000
  if (PRICE_WORDS.some((w) => lower.includes(w))) {
    filters.maxPrice = 5000;
    PRICE_WORDS.forEach((w) => {
      remaining = remaining.replace(w, '');
    });
  }

  // Price: under/below N or Nk
  const underMatch = remaining.match(/(?:under|below)\s+(\d+\.?\d*)\s*k?/);
  if (underMatch) {
    const num = parseFloat(underMatch[1]);
    filters.maxPrice =
      underMatch[0].includes('k') && num < 1000 ? num * 1000 : num;
    remaining = remaining.replace(underMatch[0], '');
  }

  // Price: bare number → ±500 range
  if (!filters.maxPrice) {
    const numMatch = remaining.match(/\b(\d{3,6})\b/);
    if (numMatch) {
      const num = parseInt(numMatch[1], 10);
      if (num >= 500 && num <= 100000) {
        filters.exactPrice = num;
        remaining = remaining.replace(numMatch[0], '');
      }
    }
  }

  // Gender
  if (GENDER_FEMALE.some((w) => lower.includes(w))) {
    filters.gender = 'female';
    GENDER_FEMALE.forEach((w) => {
      remaining = remaining.replace(w, '');
    });
  } else if (GENDER_MALE.some((w) => lower.includes(w))) {
    filters.gender = 'male';
    GENDER_MALE.forEach((w) => {
      remaining = remaining.replace(w, '');
    });
  }

  // Room type (check multi-word phrases first)
  for (const [patterns, value] of ROOM_TYPES) {
    for (const p of patterns) {
      if (lower.includes(p)) {
        filters.roomType = value;
        remaining = remaining.replace(p, '');
        break;
      }
    }
    if (filters.roomType) break;
  }

  // Amenities
  for (const [patterns, label] of AMENITY_MAP) {
    for (const p of patterns) {
      if (lower.includes(p)) {
        if (!filters.amenities.includes(label)) filters.amenities.push(label);
        remaining = remaining.replace(p, '');
      }
    }
  }

  // Area (check multi-word phrases first, before proximity gates)
  for (const [patterns, areaName] of AREA_KEYWORDS) {
    for (const p of patterns) {
      if (lower.includes(p)) {
        filters.area = areaName;
        remaining = remaining.replace(p, '');
        break;
      }
    }
    if (filters.area) break;
  }

  // Proximity
  if (lower.includes('gate a')) {
    filters.proximityGate = 'A';
    remaining = remaining.replace('gate a', '');
  } else if (lower.includes('gate b')) {
    filters.proximityGate = 'B';
    remaining = remaining.replace('gate b', '');
  }
  if (lower.includes('near campus') || lower.includes('close to campus')) {
    filters.sortByProximity = true;
    remaining = remaining.replace(/near campus|close to campus/g, '');
  }

  filters.freeText = remaining.replace(/\s+/g, ' ').trim();
  return filters;
}

function buildTags(filters: ParsedFilters): ActiveTag[] {
  const tags: ActiveTag[] = [];
  if (filters.maxPrice)
    tags.push({
      label: `Under KES ${filters.maxPrice.toLocaleString()}`,
      removeWord: 'cheap',
    });
  if (filters.exactPrice)
    tags.push({
      label: `~KES ${filters.exactPrice.toLocaleString()}`,
      removeWord: String(filters.exactPrice),
    });
  if (filters.gender === 'female')
    tags.push({ label: 'Ladies Only', removeWord: 'ladies' });
  if (filters.gender === 'male')
    tags.push({ label: 'Gents Only', removeWord: 'gents' });
  if (filters.roomType) {
    const labels: Record<string, string> = {
      self_contained: 'Self Contained',
      bedsitter: 'Bedsitter',
      single: 'Single Room',
      double: 'Double Room',
      shared: 'Shared',
    };
    tags.push({
      label: labels[filters.roomType] ?? filters.roomType,
      removeWord: filters.roomType.replace('_', ' '),
    });
  }
  filters.amenities.forEach((a) =>
    tags.push({ label: a, removeWord: a.toLowerCase() }),
  );
  if (filters.area)
    tags.push({
      label: filters.area,
      removeWord: filters.area.split(' ')[0].toLowerCase(),
    });
  if (filters.proximityGate)
    tags.push({
      label: `Near Gate ${filters.proximityGate}`,
      removeWord: `gate ${filters.proximityGate.toLowerCase()}`,
    });
  if (filters.sortByProximity)
    tags.push({ label: 'Near Campus', removeWord: 'near campus' });
  return tags;
}

// ── Supabase query ─────────────────────────────────────────────────────────────

async function fetchListings(filters: ParsedFilters): Promise<Listing[]> {
  const supabase = createClient();
  let q = supabase
    .from('listings')
    .select(
      'id, title, description, price, location, slug, county, area, gender, specific_location, price_single, price_sharing, distance_category, listing_images(r2_url, display_order), agents(name)',
    )
    .eq('is_active', true);

  if (filters.maxPrice) q = q.lte('price', filters.maxPrice);
  if (filters.exactPrice) {
    q = q
      .gte('price', filters.exactPrice - 500)
      .lte('price', filters.exactPrice + 500);
  }
  if (filters.gender) q = q.eq('gender', filters.gender);
  if (filters.roomType) q = q.eq('room_type_enum', filters.roomType);
  filters.amenities.forEach((a) => {
    q = q.contains('amenities', [a]);
  });
  if (filters.area) q = q.eq('area', filters.area);
  if (filters.proximityGate)
    q = q.ilike('proximity_description', `%Gate ${filters.proximityGate}%`);
  if (filters.freeText) {
    q = q.or(
      `title.ilike.%${filters.freeText}%,description.ilike.%${filters.freeText}%,location.ilike.%${filters.freeText}%`,
    );
  }

  q = filters.sortByProximity
    ? q.order('proximity_description', { ascending: true })
    : q.order('created_at', { ascending: false });

  const { data } = await q;
  return (data as Listing[]) || [];
}

// ── Skeleton ───────────────────────────────────────────────────────────────────

function ListingSkeleton() {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
      {Array.from({ length: 6 }).map((_, i) => (
        <div
          key={i}
          className="bg-white border border-slate-100 rounded-2xl overflow-hidden animate-pulse"
        >
          <div className="aspect-4/3 bg-slate-200" />
          <div className="p-4 space-y-2">
            <div className="h-3 bg-slate-200 rounded w-1/2" />
            <div className="h-4 bg-slate-200 rounded w-3/4" />
            <div className="h-3 bg-slate-200 rounded w-full" />
            <div className="h-3 bg-slate-200 rounded w-2/3" />
          </div>
        </div>
      ))}
    </div>
  );
}

// ── Main Page ──────────────────────────────────────────────────────────────────

interface HostelsSearchProps {
  initialListings: Listing[];
}

export default function HostelsPage({ initialListings }: HostelsSearchProps) {
  const router = useRouter();
  const searchParams = useSearchParams();

  const initialQuery = searchParams.get('q') ?? '';
  const [query, setQuery] = useState(initialQuery);
  const [listings, setListings] = useState<Listing[]>(initialQuery ? [] : initialListings);
  const [loading, setLoading] = useState(!!initialQuery);

  const debouncedQuery = useDebounce(query, 300);
  const filters = parseQuery(debouncedQuery);
  const tags = buildTags(filters);

  const runSearch = useCallback(async (q: string) => {
    setLoading(true);
    const parsed = parseQuery(q);
    const results = await fetchListings(parsed);
    setListings(results);
    setLoading(false);
  }, []);

  // Sync URL and fire query when debounced value changes
  useEffect(() => {
    const url = debouncedQuery
      ? `/hostels?q=${encodeURIComponent(debouncedQuery)}`
      : '/hostels';
    router.replace(url);
    runSearch(debouncedQuery);
  }, [debouncedQuery, router, runSearch]);

  const removeTag = (removeWord: string) => {
    const regex = new RegExp(
      `\\b${removeWord.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`,
      'gi',
    );
    setQuery((prev) => prev.replace(regex, '').replace(/\s+/g, ' ').trim());
  };

  const hasFilters = tags.length > 0 || filters.freeText;

  const emptyMessage = () => {
    const parts: string[] = [];
    if (filters.gender)
      parts.push(filters.gender === 'female' ? 'ladies only' : 'gents only');
    if (filters.maxPrice)
      parts.push(`under KES ${filters.maxPrice.toLocaleString()}`);
    if (filters.exactPrice)
      parts.push(`~KES ${filters.exactPrice.toLocaleString()}`);
    if (filters.roomType) parts.push(filters.roomType.replace('_', ' '));
    filters.amenities.forEach((a) => parts.push(a.toLowerCase()));
    if (filters.freeText) parts.push(`"${filters.freeText}"`);
    return parts.length
      ? `No hostels found for ${parts.join(', ')}. Try removing some filters above.`
      : 'No hostels found. Check back soon.';
  };

  return (
    <div className="min-h-screen bg-slate-50/50 py-10">
      <div className="container mx-auto px-4 lg:px-8 max-w-6xl">
        {/* Header */}
        <div className="mb-6">
          <h1 className="text-3xl font-black text-slate-900 tracking-tight">
            Student Hostels Near DeKUT
          </h1>
          <p className="text-slate-500 font-medium mt-1">
            Type anything — room type, price, amenities, or location.
          </p>
        </div>

        {/* Search Input */}
        <div className="relative mb-3">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-400 pointer-events-none" />
          <Input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder='e.g. "cheap ladies wifi gate A" or "self contained near campus"'
            className="pl-12 h-13 text-base bg-white border-slate-200 focus-visible:ring-emerald-500 rounded-2xl shadow-sm"
          />
          {query && (
            <button
              onClick={() => setQuery('')}
              className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700 transition-colors"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>

        {/* Active Filter Tags */}
        {tags.length > 0 && (
          <div className="flex flex-wrap gap-2 mb-6">
            {tags.map((tag) => (
              <button
                key={tag.label}
                onClick={() => removeTag(tag.removeWord)}
                className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 text-xs font-semibold hover:bg-emerald-100 transition-colors"
              >
                {tag.label}
                <X className="h-3 w-3" />
              </button>
            ))}
          </div>
        )}

        {/* Results count */}
        {!loading && (
          <p className="text-sm text-slate-400 font-semibold mb-5 px-1">
            {listings.length} {listings.length === 1 ? 'hostel' : 'hostels'}{' '}
            found
            {hasFilters && (
              <span className="text-slate-300">
                {' '}
                ·{' '}
                <button
                  onClick={() => setQuery('')}
                  className="text-rose-400 hover:text-rose-500"
                >
                  Clear all
                </button>
              </span>
            )}
          </p>
        )}

        {/* Grid */}
        {loading ? (
          <ListingSkeleton />
        ) : listings.length > 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {listings.map((item) => {
              const sorted = [...(item.listing_images || [])].sort(
                (a, b) => a.display_order - b.display_order,
              );
              const imageUrl =
                sorted[0]?.r2_url ??
                'https://images.unsplash.com/photo-1555854877-bab0e564b8d5?q=80&w=600';
              const href = item.slug
                ? `/hostels/${item.county ?? 'nyeri'}/${item.area ?? 'dekut'}/${item.slug}`
                : `/listing/${item.id}`;

              // Format distance badge
              const distanceBadge = getDistanceBadgeText(
                item.distance_category,
              );

              // Format prices display
              let priceDisplay = `KES ${item.price.toLocaleString()}/mo`;
              if (item.price_single && item.price_sharing) {
                priceDisplay = `KES ${item.price_single.toLocaleString()} single · KES ${item.price_sharing.toLocaleString()} sharing`;
              } else if (item.price_single) {
                priceDisplay = `KES ${item.price_single.toLocaleString()}/mo single`;
              } else if (item.price_sharing) {
                priceDisplay = `KES ${item.price_sharing.toLocaleString()}/mo sharing`;
              }

              // Area display with specific location
              let areaDisplay = item.area || 'Hostel Area';
              if (item.specific_location) {
                areaDisplay = `${areaDisplay} · ${item.specific_location}`;
              }

              return (
                <Link
                  key={item.id}
                  href={href}
                  className="group flex flex-col bg-white border border-slate-100 rounded-2xl overflow-hidden hover:shadow-lg transition-all duration-300 h-full"
                >
                  <div className="relative aspect-4/3 overflow-hidden bg-slate-100">
                    <Image
                      src={imageUrl}
                      alt={`${item.title} — student hostel near DeKUT`}
                      fill
                      className="object-cover transition-transform duration-500 group-hover:scale-105"
                      sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
                    />

                    {/* Distance Badge - Top Left */}
                    {distanceBadge && (
                      <div className="absolute top-3 left-3 bg-slate-900/70 backdrop-blur-sm px-2.5 py-1 rounded-full text-xs font-bold shadow-xs text-white">
                        {distanceBadge}
                      </div>
                    )}

                    {/* Gender Badge - Top Right */}
                    {item.gender && item.gender !== 'mixed' && (
                      <div
                        className={`absolute top-3 right-3 px-2.5 py-1 rounded-full text-xs font-bold shadow-xs text-white ${
                          item.gender === 'female'
                            ? 'bg-pink-600/90'
                            : 'bg-blue-600/90'
                        } backdrop-blur-sm`}
                      >
                        {item.gender === 'female'
                          ? 'Ladies Only'
                          : 'Gents Only'}
                      </div>
                    )}

                    {/* Price - If not showing area below, show here */}
                    {!item.area && (
                      <div className="absolute top-3 right-3 bg-white/95 backdrop-blur-xs px-2.5 py-1 rounded-lg text-xs font-bold shadow-xs text-slate-900 border border-slate-100/50">
                        {priceDisplay.split('/')[0]}
                      </div>
                    )}
                  </div>

                  <div className="p-4 flex-1 flex flex-col">
                    {/* Title */}
                    <h3 className="font-bold text-slate-900 line-clamp-1 group-hover:text-emerald-600 transition-colors">
                      {item.title}
                    </h3>

                    {/* Area and Specific Location - Below Title */}
                    <div className="flex items-center gap-1 text-slate-500 text-xs font-semibold mt-1 mb-2 truncate">
                      <MapPin className="h-3 w-3 shrink-0" />
                      <span className="truncate">{areaDisplay}</span>
                    </div>

                    {/* Description */}
                    <p className="text-slate-500 text-xs line-clamp-2 mb-4 flex-1">
                      {item.description}
                    </p>

                    {/* Pricing - Always show clearly */}
                    <div className="mb-3 pt-2 border-t border-slate-100">
                      <p className="text-sm font-bold text-emerald-600">
                        {priceDisplay}
                      </p>
                    </div>

                    {/* Footer */}
                    <div className="border-t border-slate-100 pt-3 flex items-center justify-between text-xs text-slate-400">
                      <span>Agent: {item.agents?.name ?? 'Rumia Agent'}</span>
                      <span className="font-semibold text-emerald-600 group-hover:underline flex items-center gap-0.5">
                        <Eye className="h-3.5 w-3.5" /> View
                      </span>
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        ) : (
          <div className="text-center py-24 bg-white border border-slate-100 rounded-2xl">
            <p className="text-slate-500 font-semibold text-sm max-w-sm mx-auto">
              {emptyMessage()}
            </p>
            {tags.length > 0 && (
              <button
                onClick={() => setQuery('')}
                className="mt-5 inline-flex items-center px-5 py-2.5 bg-slate-900 text-white rounded-xl text-sm font-semibold hover:bg-slate-800 transition-colors"
              >
                Clear search
              </button>
            )}
          </div>
        )}

        <div className="mt-8">
          <EarlyAccessBanner />
        </div>
      </div>
    </div>
  );
}
