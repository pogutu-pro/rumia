import { createClient } from '@/lib/supabase/server';
import { notFound } from 'next/navigation';
import { Metadata } from 'next';
import Link from 'next/link';
import Image from 'next/image';
import { MapPin, ArrowLeft, Calendar, ShieldCheck, Globe } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { UserAvatar } from '@/components/ui/user-avatar';
import { JsonLd } from '@/components/seo/json-ld';
import { AgentContactSection } from '@/components/agents/agent-contact-section';
import { ShareAgentProfile } from '@/components/agents/share-agent-profile';

export const revalidate = 3600;

interface PageProps {
  params: Promise<{ slug: string }>;
}

async function getAgent(slug: string) {
  const supabase = await createClient();
  const { data } = await supabase
    .from('agents')
    .select('*')
    .eq('slug', slug)
    .eq('status', 'active')
    .single();
  return data as Record<string, any> | null;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const agent = await getAgent(slug);
  if (!agent) return { title: 'Agent Not Found' };

  const metadataBase = process.env.NEXT_PUBLIC_APP_URL || 'https://www.rumia.co.ke';
  const canonical = `${metadataBase}/agents/${slug}`;
  const name = agent.name || 'Hostel Agent';
  const bio = agent.bio ? `${agent.bio.slice(0, 120)}` : `Student hostel agent near Dedan Kimathi University in Nyeri, Kenya.`;
  const title = `${name} — ${agent.verified ? 'Verified ' : ''}Hostel Agent Near DeKUT`;
  const description = `${name} helps students find verified hostels near DeKUT. ${bio}`.slice(0, 160);

  return {
    title,
    description,
    alternates: { canonical },
    openGraph: {
      title,
      description,
      url: canonical,
      siteName: 'Rumia',
      type: 'profile',
      ...(agent.profile_photo_url ? { images: [{ url: agent.profile_photo_url, width: 400, height: 400 }] } : {}),
    },
    twitter: {
      card: 'summary',
      title,
      description,
    },
  };
}

export default async function AgentSlugPage({ params }: PageProps) {
  const { slug } = await params;
  const agent = await getAgent(slug);
  if (!agent) notFound();

  const supabase = await createClient();
  const { data: listingsData } = await supabase
    .from('listings')
    .select(`
      id, title, description, price, location, slug, county, area, is_active,
      listing_images ( r2_url, display_order )
    `)
    .eq('agent_id', agent.id)
    .eq('is_active', true)
    .order('id', { ascending: false });

  const listings = (listingsData || []) as any[];
  const metadataBase = process.env.NEXT_PUBLIC_APP_URL || 'https://www.rumia.co.ke';
  const canonicalUrl = `${metadataBase}/agents/${slug}`;

  const personSchema = {
    '@context': 'https://schema.org',
    '@type': 'Person',
    name: agent.name,
    description: agent.bio || `Student hostel agent at Rumia helping students find accommodation near DeKUT.`,
    url: canonicalUrl,
    ...(agent.profile_photo_url ? { image: agent.profile_photo_url } : {}),
    ...(agent.whatsapp ? { telephone: agent.whatsapp } : {}),
    knowsAbout: 'Student accommodation near Dedan Kimathi University of Technology',
    ...(agent.service_areas?.length
      ? {
          areaServed: agent.service_areas.map((area: string) => ({
            '@type': 'Place',
            name: area,
          })),
        }
      : {}),
  };

  return (
    <div className="min-h-screen bg-white">
      <JsonLd data={personSchema} />

      {/* Back link */}
      <div className="container mx-auto px-4 lg:px-8 pt-6">
        <Link
          href="/hostels"
          className="inline-flex items-center gap-1.5 text-sm font-semibold text-slate-500 hover:text-slate-900 transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to listings
        </Link>
      </div>

      {/* Cover Image */}
      <div className="relative w-full h-56 sm:h-72 lg:h-80 mt-4 overflow-hidden">
        {agent.cover_image_url ? (
          <Image
            src={agent.cover_image_url}
            alt={`${agent.name}'s cover photo`}
            fill
            unoptimized
            className="object-cover"
            priority
            sizes="100vw"
          />
        ) : (
          <div className="absolute inset-0 bg-gradient-to-r from-emerald-800 via-emerald-700 to-teal-600">
            <div className="absolute inset-0 opacity-10" style={{
              backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23ffffff' fill-opacity='0.4'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")`,
            }} />
          </div>
        )}

        {/* Profile photo overlap */}
        <div className="absolute -bottom-14 left-4 sm:left-8">
          <div className="relative">
            <UserAvatar
              name={agent.name}
              imageUrl={agent.profile_photo_url}
              size="xl"
              className="ring-4 ring-white shadow-lg"
            />
          </div>
        </div>
      </div>

      {/* Spacer for profile photo overlap */}
      <div className="h-16" />

      {/* Profile Content */}
      <div className="container mx-auto px-4 lg:px-8 pb-16">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Main Column */}
          <div className="lg:col-span-2 space-y-8">
            {/* Name & Badges */}
            <div>
              <div className="flex items-center gap-3 flex-wrap">
                <h1 className="text-3xl sm:text-4xl font-black text-slate-900 tracking-tight">
                  {agent.name}
                </h1>
                {agent.verified && (
                  <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-emerald-50 text-emerald-700 text-xs font-bold border border-emerald-200">
                    <ShieldCheck className="h-3.5 w-3.5" />
                    Verified
                  </span>
                )}
              </div>
              <p className="text-sm font-semibold text-slate-500 mt-1">
                Student Hostel Agent &middot; Nyeri, Kenya
              </p>

              {/* Helping Since */}
              {agent.helping_since && (
                <p className="inline-flex items-center gap-1.5 text-sm text-slate-500 mt-2">
                  <Calendar className="h-4 w-4 text-slate-400" />
                  Helping students since {agent.helping_since}
                </p>
              )}

              {/* Social Handles — top placement */}
              <div className="mt-4">
                <AgentContactSection
                  whatsapp={agent.whatsapp || agent.phone || ''}
                  instagram={agent.instagram}
                  linkedin={agent.linkedin}
                  instagramPublic={agent.instagram_public}
                  linkedinPublic={agent.linkedin_public}
                  horizontal
                />
              </div>
            </div>

            {/* Bio */}
            {agent.bio && (
              <div>
                <h2 className="text-lg font-bold text-slate-900 mb-2">About</h2>
                <p className="text-slate-600 leading-relaxed">{agent.bio}</p>
              </div>
            )}

            {/* Service Areas */}
            {agent.service_areas && agent.service_areas.length > 0 && (
              <div>
                <h2 className="text-lg font-bold text-slate-900 mb-3">Service Areas</h2>
                <div className="flex flex-wrap gap-2">
                  {agent.service_areas.map((area: string) => (
                    <Badge key={area} variant="secondary" className="px-3 py-1.5 text-sm font-medium">
                      <MapPin className="h-3 w-3 mr-1 inline" />
                      {area}
                    </Badge>
                  ))}
                </div>
              </div>
            )}

            {/* Languages */}
            {agent.languages && agent.languages.length > 0 && (
              <div>
                <h2 className="text-lg font-bold text-slate-900 mb-3">Languages</h2>
                <div className="flex flex-wrap gap-2">
                  {agent.languages.map((lang: string) => (
                    <Badge key={lang} variant="outline" className="px-3 py-1.5 text-sm font-medium">
                      <Globe className="h-3 w-3 mr-1 inline" />
                      {lang}
                    </Badge>
                  ))}
                </div>
              </div>
            )}

            {/* Active Listings */}
            <div>
              <h2 className="text-2xl font-extrabold text-slate-950 tracking-tight mb-6">
                {listings.length > 0
                  ? `Listings by ${agent.name}`
                  : 'Current Hostels'}
              </h2>

              {listings.length > 0 ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                  {listings.map((item) => {
                    const sortedImages = (item.listing_images || []).sort(
                      (a: any, b: any) => a.display_order - b.display_order,
                    );
                    const imageUrl = sortedImages[0]?.r2_url;
                    const href = item.slug
                      ? `/hostels/${item.county || 'nyeri'}/${item.area || 'dekut'}/${item.slug}`
                      : `/listing/${item.id}`;

                    return (
                      <Link
                        key={item.id}
                        href={href}
                        className="group flex flex-col bg-white border border-slate-100 rounded-2xl overflow-hidden hover:shadow-lg transition-all duration-300"
                      >
                        <div className="relative aspect-4/3 overflow-hidden bg-slate-100">
                          {imageUrl ? (
                            <Image
                              src={imageUrl}
                              alt={`${item.title} — student hostel`}
                              fill
                              className="object-cover transition-transform duration-500 group-hover:scale-105"
                              sizes="(max-width: 640px) 100vw, 50vw"
                            />
                          ) : (
                            <div className="flex h-full items-center justify-center text-xs font-bold uppercase tracking-wider text-slate-400">
                              No image
                            </div>
                          )}
                          <div className="absolute top-3 right-3 bg-white/95 backdrop-blur-sm px-2.5 py-1 rounded-lg text-xs font-bold shadow-sm text-slate-900 border border-slate-100/50">
                            KES {item.price.toLocaleString()}/mo
                          </div>
                        </div>
                        <div className="p-4">
                          <div className="flex items-center gap-1 text-slate-400 text-xs font-semibold mb-1 uppercase tracking-wider">
                            <MapPin className="h-3 w-3 shrink-0" />
                            <span className="truncate">{item.location}</span>
                          </div>
                          <h3 className="font-bold text-slate-900 line-clamp-1 group-hover:text-emerald-600 transition-colors">
                            {item.title}
                          </h3>
                          <p className="text-slate-500 text-xs line-clamp-2 mt-1">
                            {item.description}
                          </p>
                        </div>
                      </Link>
                    );
                  })}
                </div>
              ) : (
                <div className="text-center py-16 bg-slate-50 border border-slate-100 rounded-2xl">
                  <div className="text-4xl mb-3">🏠</div>
                  <p className="text-slate-500 font-medium">No active listings at the moment</p>
                  <p className="text-slate-400 text-sm mt-1">
                    Check back later or contact the agent directly.
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* Sidebar */}
          <aside className="lg:col-span-1">
            <div className="lg:sticky lg:top-24 space-y-4">
              <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6">
                <ShareAgentProfile
                  name={agent.name}
                  url={`/agents/${slug}`}
                />
              </div>

              {/* Summary Card */}
              {listings.length > 0 && (
                <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6">
                  <h3 className="text-sm font-bold text-slate-400 uppercase tracking-wider">
                    Summary
                  </h3>
                  <div className="mt-3 space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-slate-600">Active listings</span>
                      <span className="text-sm font-bold text-slate-900">{listings.length}</span>
                    </div>
                    {agent.helping_since && (
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-slate-600">Experience</span>
                        <span className="text-sm font-bold text-slate-900">
                          {new Date().getFullYear() - agent.helping_since}+ years
                        </span>
                      </div>
                    )}
                    {agent.service_areas && (
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-slate-600">Areas covered</span>
                        <span className="text-sm font-bold text-slate-900">{agent.service_areas.length}</span>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          </aside>
        </div>
      </div>
    </div>
  );
}
