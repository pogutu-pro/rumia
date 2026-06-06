import Link from 'next/link';
import Image from 'next/image';
import { Search, MapPin, DollarSign, ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { createClient } from '@/lib/supabase/server';

export const revalidate = 0; // Disable caching to fetch live data

export default async function HomePage() {
  const supabase = await createClient();

  // Fetch active listings with their first image and agent name
  const { data: listingsData } = await supabase
    .from('listings')
    .select(`
      id,
      title,
      description,
      price,
      location,
      agent_id,
      is_active,
      listing_images (
        r2_url,
        display_order
      ),
      agents (
        name
      )
    `)
    .eq('is_active', true)
    .limit(8);

  let listings = (listingsData || []) as any[];



  // Get unique locations for quick search suggestions
  const { data: locsData } = await supabase
    .from('listings')
    .select('location')
    .eq('is_active', true);
  
  let uniqueLocations: string[];
  if (locsData && locsData.length > 0) {
    uniqueLocations = (Array.from(
      new Set(locsData.map((l: any) => l.location.split(',')[0].trim()))
    ) as string[]).slice(0, 4);
  } else {
    uniqueLocations = (Array.from(
      new Set(listings.map((l: any) => l.location.split(',')[0].trim()))
    ) as string[]).slice(0, 4);
  }

  return (
    <div className="flex flex-col min-h-screen bg-slate-50/50">
      {/* Hero Section */}
      <section className="relative py-20 lg:py-32 overflow-hidden bg-slate-950 text-white">
        <div className="absolute inset-0 bg-[url('https://images.unsplash.com/photo-1555854877-bab0e564b8d5?q=80&w=1600')] bg-cover bg-center" />
        <div className="absolute inset-0 bg-slate-950/60" />
        <div className="absolute inset-0 opacity-30 bg-[radial-gradient(circle_at_top_right,_var(--tw-gradient-stops))] from-emerald-500 via-transparent to-transparent" />
        
        <div className="container relative z-10 mx-auto px-4 text-center max-w-4xl">
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 mb-6 animate-fade-in">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            Verified Campus Housing
          </span>
          
          <h1 className="text-4xl sm:text-6xl font-black tracking-tight leading-[1.1] mb-6">
            Find Your Perfect <br className="hidden sm:block" />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-emerald-400 to-teal-300">
              Campus Accommodation
            </span>
          </h1>
          
          <p className="text-lg text-slate-300 max-w-2xl mx-auto mb-10 font-medium leading-relaxed">
            Search hundreds of verified hostels near your university. Direct contact with trusted agents. No hidden booking fees.
          </p>

          {/* Search Bar Widget */}
          <div className="bg-white p-2 sm:p-3 rounded-2xl shadow-2xl border border-slate-100 max-w-3xl mx-auto text-slate-800">
            <form action="/browse" method="GET" className="flex flex-col sm:flex-row items-center gap-2">
              <div className="relative flex-1 w-full">
                <MapPin className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 h-5 w-5" />
                <Input
                  type="text"
                  name="search"
                  placeholder="Enter university or town (e.g. Juja, Madaraka...)"
                  className="w-full pl-12 pr-4 h-12 border-0 focus-visible:ring-0 text-base font-medium placeholder-slate-400"
                />
              </div>
              
              <div className="h-6 w-px bg-slate-200 hidden sm:block" />
              
              <div className="relative w-full sm:w-48">
                <DollarSign className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 h-5 w-5" />
                <Input
                  type="number"
                  name="maxPrice"
                  placeholder="Max budget (KES)"
                  className="w-full pl-12 pr-4 h-12 border-0 focus-visible:ring-0 text-base font-medium placeholder-slate-400"
                />
              </div>
              
              <Button type="submit" size="lg" className="w-full sm:w-auto h-12 px-8 bg-emerald-600 hover:bg-emerald-500 text-white font-semibold rounded-xl transition-all duration-300 shadow-md shadow-emerald-600/10">
                <Search className="h-4 w-4 mr-2" />
                Search
              </Button>
            </form>
          </div>

          {/* Quick Locations */}
          {uniqueLocations.length > 0 && (
            <div className="mt-8 flex items-center justify-center flex-wrap gap-2 text-sm text-slate-400">
              <span className="font-semibold text-slate-300 mr-1">Popular:</span>
              {uniqueLocations.map((loc) => (
                <Link
                  key={loc}
                  href={`/browse?search=${encodeURIComponent(loc)}`}
                  className="px-3.5 py-1.5 rounded-full bg-slate-800/60 border border-slate-700/50 text-slate-300 hover:bg-slate-800 hover:border-slate-600 hover:text-white transition-all font-medium"
                >
                  {loc}
                </Link>
              ))}
            </div>
          )}
        </div>
      </section>

      {/* Featured Grid */}
      <section className="container mx-auto px-4 py-16 sm:py-24">
        <div className="flex items-end justify-between mb-10">
          <div>
            <h2 className="text-2xl sm:text-4xl font-extrabold tracking-tight text-slate-950">
              Featured Hostels
            </h2>
            <p className="text-slate-500 mt-2 font-medium">
              Explore the latest premium student rooms available right now.
            </p>
          </div>
          <Link href="/browse" className="group hidden sm:flex items-center text-sm font-semibold text-emerald-600 hover:text-emerald-500 transition-colors">
            View all listings
            <ArrowRight className="ml-1 h-4 w-4 group-hover:translate-x-0.5 transition-transform" />
          </Link>
        </div>

        {listings && listings.length > 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {listings.map((item) => {
              // Get display image or fallback
              const sortedImages = (item.listing_images || []).sort(
                (a: any, b: any) => a.display_order - b.display_order
              );
              const imageUrl =
                sortedImages[0]?.r2_url ||
                'https://images.unsplash.com/photo-1555854877-bab0e564b8d5?q=80&w=600';

              return (
                <Link
                  key={item.id}
                  href={`/listing/${item.id}`}
                  className="group flex flex-col bg-white border border-slate-100 rounded-2xl overflow-hidden hover:shadow-xl hover:-translate-y-1 transition-all duration-300 h-full"
                >
                  <div className="relative aspect-4/3 overflow-hidden bg-slate-100">
                    <img
                      src={imageUrl}
                      alt={item.title}
                      className="object-cover w-full h-full transition-transform duration-500 group-hover:scale-105"
                      loading="lazy"
                    />
                    <div className="absolute top-3 right-3 bg-white/95 backdrop-blur-xs px-2.5 py-1 rounded-lg text-xs font-bold shadow-sm text-slate-900 border border-slate-100/50">
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
                    
                    <p className="text-slate-500 text-sm line-clamp-2 mt-1 mb-4 flex-1">
                      {item.description}
                    </p>

                    <div className="pt-3 border-t border-slate-100 flex items-center justify-between text-xs text-slate-400">
                      <span>Agent: {item.agents?.name || 'Rumia Agent'}</span>
                      <span className="font-semibold text-emerald-600 group-hover:underline flex items-center gap-0.5">
                        Details
                        <ArrowRight className="h-3 w-3" />
                      </span>
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        ) : (
          <div className="text-center py-20 bg-white border border-slate-100 rounded-3xl">
            <p className="text-slate-400 font-medium">No listings found.</p>
            <Link href="/dashboard/new" className="mt-4 inline-flex items-center px-4 py-2 bg-slate-900 text-white rounded-xl text-sm font-semibold hover:bg-slate-800 transition-colors">
              Create First Listing
            </Link>
          </div>
        )}

        <div className="mt-10 text-center sm:hidden">
          <Link href="/browse" className="inline-flex items-center gap-2 px-5 py-3 rounded-xl bg-slate-900 text-white font-semibold text-sm hover:bg-slate-800 transition-colors">
            View All Listings
            <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </section>
    </div>
  );
}
