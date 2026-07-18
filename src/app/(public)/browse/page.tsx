import Link from 'next/link';
import Image from 'next/image';
import { Search, MapPin, DollarSign, ArrowRight, SlidersHorizontal, Eye } from 'lucide-react';
import { Metadata } from 'next';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { createClient } from '@/lib/supabase/server';
import { sortListingsByPosition } from '@/lib/utils/listing-sort';

export const revalidate = 0;

const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://www.rumia.co.ke';

export const metadata: Metadata = {
  title: 'Browse Student Hostels Near DeKUT',
  description:
    'Browse all verified student hostels near Dedan Kimathi University of Technology in Nyeri, Kenya. Filter by price and location.',
  alternates: { canonical: `${baseUrl}/browse` },
};

interface PageProps {
  searchParams: Promise<{
    search?: string;
    minPrice?: string;
    maxPrice?: string;
  }>;
}

export default async function BrowsePage({ searchParams }: PageProps) {
  const { search, minPrice, maxPrice } = await searchParams;

  const supabase = await createClient();

  // Construct query
  let dbQuery = supabase
    .from('listings')
    .select(`
      id,
      title,
      description,
      price,
      location,
      agent_id,
      is_active,
      slug,
      county,
      area,
      created_at,
      sort_position,
      listing_images (
        r2_url,
        display_order
      ),
      agents (
        name
      )
    `)
    .eq('is_active', true);

  if (search) {
    dbQuery = dbQuery.or(`location.ilike.%${search}%,title.ilike.%${search}%`);
  }

  if (minPrice) {
    const minVal = parseFloat(minPrice);
    if (!isNaN(minVal)) {
      dbQuery = dbQuery.gte('price', minVal);
    }
  }

  if (maxPrice) {
    const maxVal = parseFloat(maxPrice);
    if (!isNaN(maxVal)) {
      dbQuery = dbQuery.lte('price', maxVal);
    }
  }

  // Order listings by ID descending
  dbQuery = dbQuery.order('id', { ascending: false });

  const { data: listingsData } = await dbQuery;
  let listings = sortListingsByPosition((listingsData || []) as any[]);





  return (
    <div className="min-h-screen bg-slate-50/50 py-8">
      <div className="container mx-auto px-4 lg:px-8">
        <div className="mb-8">
          <h1 className="text-3xl font-black text-slate-900 tracking-tight">
            Browse Campus Hostels
          </h1>
          <p className="text-slate-500 font-medium mt-1">
            Showing verified accommodations and rooms near your campus.
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-4 gap-8 items-start">
          {/* Filters Sticky Sidebar */}
          <aside className="lg:sticky lg:top-24 bg-white p-6 rounded-2xl border border-slate-100 shadow-xs space-y-6">
            <div className="flex items-center justify-between pb-4 border-b border-slate-100">
              <h2 className="font-bold text-slate-900 flex items-center gap-2">
                <SlidersHorizontal className="h-4 w-4 text-emerald-600" />
                Filters
              </h2>
              {(search || minPrice || maxPrice) && (
                <Link
                  href="/browse"
                  className="text-xs font-semibold text-rose-500 hover:text-rose-600"
                >
                  Clear All
                </Link>
              )}
            </div>

            <form action="/browse" method="GET" className="space-y-4">
              {/* Keyword Search */}
              <div className="space-y-2">
                <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">
                  Keywords
                </label>
                <div className="relative">
                  <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 h-4 w-4" />
                  <Input
                    type="text"
                    name="search"
                    defaultValue={search || ''}
                    placeholder="University, town, name..."
                    className="pl-10 h-11 bg-slate-50 border-slate-200/80 focus-visible:ring-emerald-500"
                  />
                </div>
              </div>

              {/* Price Filters */}
              <div className="space-y-2">
                <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">
                  Monthly Budget (KES)
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <div className="relative">
                    <DollarSign className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 h-3.5 w-3.5" />
                    <Input
                      type="number"
                      name="minPrice"
                      defaultValue={minPrice || ''}
                      placeholder="Min"
                      className="pl-8 h-11 bg-slate-50 border-slate-200/80 focus-visible:ring-emerald-500 text-sm font-medium"
                    />
                  </div>
                  <div className="relative">
                    <DollarSign className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 h-3.5 w-3.5" />
                    <Input
                      type="number"
                      name="maxPrice"
                      defaultValue={maxPrice || ''}
                      placeholder="Max"
                      className="pl-8 h-11 bg-slate-50 border-slate-200/80 focus-visible:ring-emerald-500 text-sm font-medium"
                    />
                  </div>
                </div>
              </div>

              <Button
                type="submit"
                className="w-full h-11 bg-emerald-600 hover:bg-emerald-500 text-white font-semibold transition-all duration-300 shadow-sm"
              >
                Apply Filters
              </Button>
            </form>
          </aside>

          {/* Listings Grid */}
          <div className="lg:col-span-3 space-y-6">
            <div className="flex items-center justify-between text-sm text-slate-400 font-semibold px-1">
              <span>{listings ? listings.length : 0} Listings found</span>
            </div>

            {listings && listings.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {listings.map((item) => {
                  const sortedImages = (item.listing_images || []).sort(
                    (a: any, b: any) => a.display_order - b.display_order
                  );
                  const imageUrl =
                    sortedImages[0]?.r2_url ||
                    'https://images.unsplash.com/photo-1555854877-bab0e564b8d5?q=80&w=600';

                  return (
                    <Link
                      key={item.id}
                      href={item.slug ? `/hostels/${item.county || 'nyeri'}/${item.area || 'dekut'}/${item.slug}` : `/listing/${item.id}`}
                      className="group flex flex-col bg-white border border-slate-100 rounded-2xl overflow-hidden hover:shadow-lg transition-all duration-300 h-full"
                    >
                      <div className="relative aspect-4/3 overflow-hidden bg-slate-100">
                        <Image
                          src={imageUrl}
                          alt={`${item.title} — student hostel near DeKUT Nyeri`}
                          fill
                          className="object-cover transition-transform duration-500 group-hover:scale-105"
                          sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
                        />
                        <div className="absolute top-3 right-3 bg-white/95 backdrop-blur-xs px-2.5 py-1 rounded-lg text-xs font-bold shadow-xs text-slate-900 border border-slate-100/50">
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

                        <p className="text-slate-500 text-xs line-clamp-2 mt-1 mb-4 flex-1">
                          {item.description}
                        </p>

                        <div className="pt-3 border-t border-slate-100 flex items-center justify-between text-xs text-slate-400">
                          <span>Agent: {item.agents?.name || 'Rumia Agent'}</span>
                          <span className="font-semibold text-emerald-600 group-hover:underline flex items-center gap-0.5">
                            <Eye className="h-3.5 w-3.5" />
                            View
                          </span>
                        </div>
                      </div>
                    </Link>
                  );
                })}
              </div>
            ) : (
              <div className="text-center py-24 bg-white border border-slate-100 rounded-2xl">
                <p className="text-slate-400 font-medium">No results match your criteria.</p>
                <Link
                  href="/browse"
                  className="mt-4 inline-flex items-center px-4 py-2 bg-slate-900 text-white rounded-xl text-sm font-semibold hover:bg-slate-800 transition-colors"
                >
                  Clear Filters
                </Link>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
