import { createClient } from '@/lib/supabase/server';
import { notFound } from 'next/navigation';
import { MapPin, ArrowLeft, Eye, Star, Share2, Heart, Award, ArrowRight, ShieldCheck, Zap, Droplets, CheckCircle2 } from 'lucide-react';
import Link from 'next/link';
import { ImageGallery } from './image-gallery';
import { WhatsappButton } from './whatsapp-button';
import { QuickFacts } from './quick-facts';
import { AmenitiesGrid } from './amenities-grid';
import { LocationSection } from './location-section';
import { RoomTypes } from './room-types';

export const revalidate = 0; // Live fetching

interface PageProps {
  params: Promise<{
    id: string;
  }>;
}

export default async function ListingDetailPage({ params }: PageProps) {
  const { id } = await params;
  const supabase = await createClient();

  // Fetch Listing Details along with new fields
  const { data: rawListing, error } = await supabase
    .from('listings')
    .select(`
      id,
      title,
      description,
      price,
      location,
      agent_id,
      youtube_id,
      is_active,
      amenities,
      rating,
      views,
      bathroom_type,
      distance_to_campus,
      security_type,
      electricity_included,
      water_included,
      wifi_included,
      listing_images (
        id,
        r2_url,
        display_order
      ),
      agents (
        id,
        name,
        phone,
        whatsapp
      ),
      listing_room_types (
        id,
        room_type,
        price,
        is_available
      )
    `)
    .eq('id', id)
    .single();

  let listing = rawListing as any;
  let similarListings: any[] = [];

  if (error || !listing || !listing.is_active) {
    notFound();
  }

  // Fetch Similar Hostels from DB
  const { data: rawSimilar } = await supabase
    .from('listings')
    .select(`
      id,
      title,
      price,
      location,
      listing_images (
        r2_url
      )
    `)
    .eq('is_active', true)
    .neq('id', id)
    .limit(3);

  similarListings = (rawSimilar || []) as any[];

  // Sort images
  const images = (listing.listing_images || []).sort(
    (a: any, b: any) => a.display_order - b.display_order
  );

  // Format amenities array from DB, or fallback
  const dbAmenities = listing.amenities || [];
  
  return (
    <div className="min-h-screen bg-white pb-24 md:pb-16 font-sans">
      {/* Top Bar Navigation */}
      <div className="border-b border-slate-100 bg-white sticky top-0 z-30 hidden md:block">
        <div className="container mx-auto px-4 lg:px-8 py-4 flex items-center justify-between">
          <Link
            href="/browse"
            className="inline-flex items-center gap-2 text-sm font-semibold text-slate-600 hover:text-slate-900 transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to listings
          </Link>
          <div className="flex items-center gap-4">
            <button className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-600 hover:text-slate-900 transition-colors">
              <Share2 className="h-4 w-4" />
              Share
            </button>
            <button className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-600 hover:text-slate-900 transition-colors">
              <Heart className="h-4 w-4" />
              Save
            </button>
          </div>
        </div>
      </div>

      {/* Hero Gallery Section */}
      <div className="md:container md:mx-auto md:px-4 lg:px-8 md:pt-6">
        <ImageGallery images={images} />
      </div>

      <div className="container mx-auto px-4 lg:px-8 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-12">
          
          {/* Main content - Left Column */}
          <div className="lg:col-span-2 space-y-10">
            
            {/* Header info */}
            <div className="space-y-4">
              <div className="flex flex-wrap items-center gap-3">
                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-700 text-xs font-semibold">
                  <Star className="h-3.5 w-3.5 fill-current" />
                  {listing.rating || '4.7'} Rating
                </span>
                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-blue-50 text-blue-700 text-xs font-semibold">
                  <Eye className="h-3.5 w-3.5" />
                  {listing.views || '1,200'} student views this month
                </span>
              </div>

              <h1 className="text-2xl sm:text-4xl font-extrabold text-slate-950 tracking-tight leading-tight">
                {listing.title}
              </h1>

              <div className="flex items-center gap-1.5 text-slate-500 font-semibold text-sm">
                <MapPin className="h-4.5 w-4.5 text-slate-400" />
                <span>{listing.location}</span>
              </div>
            </div>

            <hr className="border-slate-100" />

            {/* Quick Facts Row */}
            <QuickFacts 
              roomType={listing.room_type}
              bathroom={listing.bathroom_type}
              internet={listing.wifi_included}
              electricity={listing.electricity_included}
              distance={listing.distance_to_campus}
              security={listing.security_type}
            />

            <hr className="border-slate-100" />

            {/* About Section */}
            <div className="space-y-4">
              <h2 className="text-xl font-bold text-slate-950">About this hostel</h2>
              <div className="text-slate-600 space-y-3 font-medium text-sm sm:text-base leading-relaxed">
                {listing.description ? (
                  listing.description.split('\n').map((para: string, idx: number) => {
                    if (!para.trim()) return null;
                    return (
                      <p key={idx} className="flex items-start gap-2">
                        <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 mt-2.5 shrink-0" />
                        <span>{para}</span>
                      </p>
                    );
                  })
                ) : (
                  <div className="space-y-2.5">
                    <p className="flex items-start gap-2">
                      <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 mt-2.5 shrink-0" />
                      <span>Located opposite Gate B.</span>
                    </p>
                    <p className="flex items-start gap-2">
                      <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 mt-2.5 shrink-0" />
                      <span>Popular among first and second-year students.</span>
                    </p>
                    <p className="flex items-start gap-2">
                      <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 mt-2.5 shrink-0" />
                      <span>Walking distance to lecture halls.</span>
                    </p>
                    <p className="flex items-start gap-2">
                      <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 mt-2.5 shrink-0" />
                      <span>Water available daily.</span>
                    </p>
                    <p className="flex items-start gap-2">
                      <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 mt-2.5 shrink-0" />
                      <span>Quiet environment suitable for studying.</span>
                    </p>
                  </div>
                )}
              </div>
            </div>

            <hr className="border-slate-100" />

            {/* Amenities Section */}
            <AmenitiesGrid amenities={dbAmenities} />

            <hr className="border-slate-100" />

            {/* Room Types and Pricing */}
            <RoomTypes 
              roomTypes={listing.listing_room_types || []}
              fallbackPrice={listing.price}
            />

            <hr className="border-slate-100" />

            {/* Video Tour Section */}
            {listing.youtube_id && (
              <div className="space-y-4">
                <h2 className="text-xl font-bold text-slate-950">Take a Video Tour</h2>
                <div className="relative aspect-video w-full overflow-hidden rounded-2xl border border-slate-100 shadow-sm">
                  <iframe
                    width="100%"
                    height="100%"
                    src={`https://www.youtube.com/embed/${listing.youtube_id}`}
                    title="YouTube listing walkthrough video player"
                    frameBorder="0"
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                    allowFullScreen
                    className="absolute inset-0 w-full h-full"
                  ></iframe>
                </div>
                <p className="text-xs font-semibold text-slate-500">
                  Walkthrough video provided by the host. Trust increases dramatically when seeing the exact layout.
                </p>
              </div>
            )}

            <hr className="border-slate-100" />

            {/* Location Map Section */}
            <LocationSection 
              locationName={listing.location}
            />

            <hr className="border-slate-100" />

            {/* Reviews Section */}
            <div className="bg-slate-50 rounded-2xl p-6 border border-slate-100 space-y-3">
              <h2 className="text-lg font-bold text-slate-900">Student Reviews</h2>
              <p className="text-sm font-semibold text-slate-500 leading-normal">
                Reviews are currently being verified for authenticity. Once verification is complete, they will appear here.
              </p>
            </div>

          </div>

          {/* Action sidebar - Right Column */}
          <aside className="hidden lg:block">
            <div className="sticky top-28 bg-white p-6 rounded-2xl border border-slate-200 shadow-lg space-y-6">
              
              {/* Pricing breakdown */}
              <div>
                <span className="text-xs font-bold text-slate-400 uppercase tracking-wider block">
                  Starting Price
                </span>
                <div className="flex items-baseline gap-1 mt-1.5 text-slate-900">
                  <span className="text-3xl font-black">
                    KES {listing.price.toLocaleString()}
                  </span>
                  <span className="text-sm font-semibold text-slate-500">/ month</span>
                </div>
              </div>

              <div className="h-px bg-slate-100" />

              {/* Availability Status */}
              <div>
                <span className="text-xs font-bold text-slate-400 uppercase tracking-wider block">
                  Availability
                </span>
                {(() => {
                  const roomTypes = listing.listing_room_types || [];
                  const totalRooms = roomTypes.length;
                  const availableRooms = roomTypes.filter((rt: any) => rt.is_available);
                  const isAvailable = totalRooms === 0 || availableRooms.length > 0;

                  if (!isAvailable) {
                    return (
                      <div className="flex items-center gap-2 mt-2 text-rose-600 font-bold text-sm bg-rose-50 px-3 py-2 rounded-xl">
                        <span className="h-2.5 w-2.5 rounded-full bg-rose-500 shrink-0" />
                        <span>Fully Booked</span>
                      </div>
                    );
                  }

                  return (
                    <div className="space-y-2.5 mt-2">
                      <div className="flex items-center gap-2 text-emerald-650 font-bold text-sm bg-emerald-50 px-3 py-2 rounded-xl">
                        <span className="h-2.5 w-2.5 rounded-full bg-emerald-500 animate-pulse shrink-0" />
                        <span>Rooms Available</span>
                      </div>
                      
                      {totalRooms > 0 && (
                        <div className="text-xs space-y-1.5 pl-1.5 border-l-2 border-slate-100 mt-1">
                          {roomTypes.map((rt: any, idx: number) => (
                            <div key={idx} className="flex items-center justify-between text-slate-600 font-semibold">
                              <span>{rt.room_type}</span>
                              <span className={`text-[10px] uppercase tracking-wider font-extrabold px-1.5 py-0.5 rounded ${
                                rt.is_available 
                                  ? 'text-emerald-700 bg-emerald-105' 
                                  : 'text-slate-400 bg-slate-100 line-through'
                              }`}>
                                {rt.is_available ? 'Available' : 'Full'}
                              </span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })()}
              </div>

              <div className="h-px bg-slate-100" />

              {/* Utility checklist */}
              <div className="space-y-3.5">
                <div className="flex items-center gap-2 text-sm font-semibold text-slate-700">
                  <div className="flex h-5 w-5 items-center justify-center rounded-full bg-emerald-50 text-emerald-600">
                    <CheckCircle2 className="h-3.5 w-3.5" />
                  </div>
                  <span>Water Included</span>
                </div>
                <div className="flex items-center gap-2 text-sm font-semibold text-slate-700">
                  <div className="flex h-5 w-5 items-center justify-center rounded-full bg-emerald-50 text-emerald-600">
                    <CheckCircle2 className="h-3.5 w-3.5" />
                  </div>
                  <span>Security Included</span>
                </div>
              </div>

              {/* Booking CTA Button */}
              <WhatsappButton
                listingId={listing.id}
                agentId={listing.agents?.id}
                agentPhone={listing.agents?.whatsapp || listing.agents?.phone || ''}
              />

              {/* Agent Profile Card summary */}
              {listing.agents && (
                <div className="pt-4 border-t border-slate-100 text-center space-y-3">
                  <div className="flex items-center gap-3 justify-center">
                    <div className="w-10 h-10 rounded-full bg-slate-100 text-slate-700 flex items-center justify-center font-bold text-sm uppercase">
                      {listing.agents.name.substring(0, 2)}
                    </div>
                    <div className="text-left">
                      <h3 className="font-bold text-sm text-slate-900 leading-tight">{listing.agents.name}</h3>
                      <span className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider block">
                        Verified Agent
                      </span>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </aside>
        </div>

        {/* Similar Hostels Bottom Row */}
        {similarListings.length > 0 && (
          <div className="mt-16 pt-12 border-t border-slate-100 space-y-8">
            <div className="flex items-center justify-between">
              <h2 className="text-xl sm:text-2xl font-bold text-slate-950">You may also like</h2>
              <Link href="/browse" className="text-sm font-bold text-emerald-600 hover:text-emerald-700 inline-flex items-center gap-1">
                See all alternatives
                <ArrowRight className="h-4 w-4" />
              </Link>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {similarListings.map((item) => {
                const itemImg = item.listing_images?.[0]?.r2_url || 'https://images.unsplash.com/photo-1555854877-bab0e564b8d5?q=80&w=600';
                return (
                  <Link 
                    key={item.id} 
                    href={`/listing/${item.id}`}
                    className="group border border-slate-100 rounded-2xl overflow-hidden hover:shadow-md transition-all duration-200 flex flex-col"
                  >
                    <div className="aspect-16/10 w-full overflow-hidden bg-slate-100">
                      <img 
                        src={itemImg} 
                        alt={item.title} 
                        className="object-cover w-full h-full group-hover:scale-[1.03] transition-transform duration-300"
                      />
                    </div>
                    <div className="p-4 flex flex-col flex-1 justify-between gap-3">
                      <div>
                        <h3 className="font-bold text-slate-900 group-hover:text-emerald-600 transition-colors line-clamp-1">{item.title}</h3>
                        <p className="text-xs font-semibold text-slate-400 mt-1 flex items-center gap-0.5">
                          <MapPin className="h-3.5 w-3.5" /> {item.location}
                        </p>
                      </div>
                      <div className="flex items-baseline gap-0.5">
                        <span className="text-base font-black text-slate-900">KES {item.price.toLocaleString()}</span>
                        <span className="text-[10px] font-semibold text-slate-500 uppercase">/ month</span>
                      </div>
                    </div>
                  </Link>
                );
              })}
            </div>
          </div>
        )}

      </div>

      {/* Mobile Sticky Footer Action Card */}
      <div className="fixed bottom-0 left-0 right-0 z-40 bg-white border-t border-slate-100 px-4 py-3.5 flex items-center justify-between md:hidden shadow-[0_-8px_30px_rgb(0,0,0,0.06)]">
        <div>
          {(() => {
            const roomTypes = listing.listing_room_types || [];
            const availableRooms = roomTypes.filter((rt: any) => rt.is_available);
            const isAvailable = roomTypes.length === 0 || availableRooms.length > 0;
            return (
              <span className={`inline-flex items-center gap-1 text-[9px] font-black uppercase tracking-wider px-1.5 py-0.5 rounded mb-1 ${
                isAvailable ? 'text-emerald-700 bg-emerald-50' : 'text-rose-700 bg-rose-50'
              }`}>
                <span className={`h-1.5 w-1.5 rounded-full ${isAvailable ? 'bg-emerald-500 animate-pulse' : 'bg-rose-500'}`} />
                {isAvailable ? 'Available' : 'Booked'}
              </span>
            );
          })()}
          <div className="flex items-baseline gap-0.5">
            <span className="text-lg font-black text-slate-950">KES {listing.price.toLocaleString()}</span>
            <span className="text-xs font-semibold text-slate-500">/mo</span>
          </div>
        </div>
        
        <div className="w-[60%]">
          <WhatsappButton
            listingId={listing.id}
            agentId={listing.agents?.id}
            agentPhone={listing.agents?.whatsapp || listing.agents?.phone || ''}
          />
        </div>
      </div>

    </div>
  );
}
