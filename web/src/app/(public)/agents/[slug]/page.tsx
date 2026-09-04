import { supabasePublic } from '@/lib/supabase/public';
import { notFound } from 'next/navigation';
import { Metadata } from 'next';
import Link from 'next/link';
import Image from 'next/image';
import { MapPin, ArrowLeft, Calendar, ShieldCheck, Globe, ExternalLink } from 'lucide-react';

import { UserAvatar } from '@/components/ui/user-avatar';
import { JsonLd } from '@/components/seo/json-ld';
import { AgentContactSection } from '@/components/agents/agent-contact-section';
import { ShareAgentProfile } from '@/components/agents/share-agent-profile';
import { getCampusBySlug } from '@/lib/data/campuses';

export const revalidate = 86400;

interface PageProps {
  params: Promise<{ slug: string }>;
}

async function getAgent(slug: string) {
  const { data } = await supabasePublic
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

  const metadataBase = process.env.NEXT_PUBLIC_APP_URL || 'https://www.rumiamanage.com';
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

  const campus = await getCampusBySlug('dekut');
  const campusShortName = campus.short_name ?? 'DeKUT';

  const supabase = supabasePublic;
  const { data: listingsData } = await supabase
    .from('listings')
    .select(`
      id, title, description, price, location, slug, county, area, is_active, created_at, sort_position,
      listing_images ( r2_url, display_order )
    `)
    .eq('agent_id', agent.id)
    .eq('is_active', true)
    .order('sort_position', { ascending: true, nullsFirst: false })
    .order('created_at', { ascending: false });

  const listings = (listingsData || []) as any[];
  const metadataBase = process.env.NEXT_PUBLIC_APP_URL || 'https://www.rumiamanage.com';
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
      <div className="container mx-auto px-4 lg:px-8 pt-5">
        <Link
          href="/hostels"
          className="inline-flex items-center gap-1.5 text-sm font-semibold text-slate-400 hover:text-slate-900 transition-colors group"
        >
          <ArrowLeft className="h-4 w-4 transition-transform group-hover:-translate-x-0.5" />
          Back to listings
        </Link>
      </div>

      {/* ═══════════════════════════════════════════════════════
          HERO: Banner + Avatar
          Key fix: overflow-hidden lives ONLY on the inner image
          div — not on the outer wrapper. The avatar is positioned
          relative to the outer wrapper and is never clipped.
      ═══════════════════════════════════════════════════════ */}
      <div className="relative w-full mt-4">
        {/* Banner — image clipping scoped to this inner div only */}
        <div
          className="relative w-full overflow-hidden bg-slate-100"
          style={{ height: 'clamp(190px, 22vw, 320px)' }}
        >
          {agent.cover_image_url ? (
            <Image
              src={agent.cover_image_url}
              alt={`${agent.name}'s cover photo`}
              fill
              className="object-cover object-center"
              priority
              sizes="100vw"
            />
          ) : (
            <div className="absolute inset-0 bg-gradient-to-br from-emerald-900 via-emerald-700 to-teal-500">
              <div
                className="absolute inset-0 opacity-[0.07]"
                style={{
                  backgroundImage: `url("data:image/svg+xml,%3Csvg width='40' height='40' viewBox='0 0 40 40' xmlns='http://www.w3.org/2000/svg'%3E%3Ccircle cx='20' cy='20' r='2' fill='%23ffffff'/%3E%3C/svg%3E")`,
                }}
              />
              <div className="absolute inset-x-0 bottom-0 h-20 bg-gradient-to-t from-emerald-900/30 to-transparent" />
            </div>
          )}
          {agent.cover_image_url && (
            <div className="absolute inset-x-0 bottom-0 h-16 bg-gradient-to-t from-black/10 to-transparent pointer-events-none" />
          )}
        </div>

        {/* Avatar — anchored to the OUTER wrapper (no overflow clip here).
            translateY(50%) centres the avatar on the banner bottom edge. */}
        <div
          className="absolute left-5 sm:left-10 lg:left-12"
          style={{ bottom: 0, transform: 'translateY(50%)' }}
        >
          <div className="relative inline-block">
            <UserAvatar
              name={agent.name}
              imageUrl={agent.profile_photo_url}
              size="2xl"
              className="ring-[4px] ring-white shadow-xl shadow-black/10"
            />
            {agent.verified && (
              <span
                className="absolute -bottom-1 -right-1 flex h-7 w-7 items-center justify-center rounded-full bg-emerald-500 ring-[3px] ring-white shadow-sm"
                title="Verified agent"
                aria-label="Verified agent"
              >
                <ShieldCheck className="h-4 w-4 text-white" aria-hidden="true" />
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Spacer = half avatar height (h-28/2 = 56px) + comfortable gap */}
      <div className="h-20 sm:h-24" />

      {/* ═══════════════════════════════════════════════════════
          PROFILE CONTENT
      ═══════════════════════════════════════════════════════ */}
      <div className="container mx-auto px-4 lg:px-8 pb-20">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 xl:gap-12">

          {/* ── Main Column (2/3) ─────────────────────── */}
          <div className="lg:col-span-2 space-y-10">

            {/* Identity block */}
            <div className="space-y-3">
              <h1 className="text-3xl sm:text-4xl font-black text-slate-900 tracking-tight leading-tight">
                {agent.name}
              </h1>

              <p className="flex items-center gap-2 text-sm font-semibold text-slate-500 flex-wrap">
                <span>Student Hostel Agent</span>
                <span className="inline-block h-1 w-1 rounded-full bg-slate-300" aria-hidden="true" />
                <span className="flex items-center gap-1">
                  <MapPin className="h-3.5 w-3.5 shrink-0 text-slate-400" />
                  Nyeri, Kenya
                </span>
              </p>

              {agent.helping_since && (
                <p className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-500 bg-slate-50 border border-slate-100 px-3 py-1.5 rounded-full">
                  <Calendar className="h-3.5 w-3.5 text-slate-400" />
                  Helping students since {agent.helping_since}
                </p>
              )}

              <div className="pt-1">
                <AgentContactSection
                  whatsapp={agent.whatsapp || agent.phone || ''}
                  agentName={agent.name}
                  poucoLaBiasharaNumber={agent.pochi_la_biashara_number}
                  expectedName={agent.expected_name}
                  instagram={agent.instagram}
                  linkedin={agent.linkedin}
                  instagramPublic={agent.instagram_public}
                  linkedinPublic={agent.linkedin_public}
                  horizontal
                />
              </div>
            </div>

            <hr className="border-slate-100" />

            {agent.portfolio_url && (
              <div className="flex items-center gap-2">
                <ExternalLink className="h-4 w-4 shrink-0 text-slate-400" aria-hidden="true" />
                <a
                  href={agent.portfolio_url.startsWith('http') ? agent.portfolio_url : `https://${agent.portfolio_url}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm font-semibold text-emerald-600 hover:text-emerald-700 hover:underline truncate transition-colors"
                  aria-label="Portfolio website"
                >
                  {(() => {
                    try {
                      const url = new URL(agent.portfolio_url.startsWith('http') ? agent.portfolio_url : `https://${agent.portfolio_url}`);
                      return url.hostname + (url.pathname !== '/' ? url.pathname : '');
                    } catch { return agent.portfolio_url; }
                  })()}
                </a>
              </div>
            )}

            {agent.bio && (
              <div className="space-y-3">
                <h2 className="text-[11px] font-bold text-slate-400 uppercase tracking-widest">About</h2>
                <p className="text-[15px] text-slate-600 leading-relaxed">{agent.bio}</p>
              </div>
            )}

            {agent.service_areas && agent.service_areas.length > 0 && (
              <div className="space-y-3">
                <h2 className="text-[11px] font-bold text-slate-400 uppercase tracking-widest">Service Areas</h2>
                <div className="flex flex-wrap gap-2">
                  {agent.service_areas.map((area: string) => (
                    <span
                      key={area}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-slate-50 border border-slate-200 text-sm font-semibold text-slate-700"
                    >
                      <MapPin className="h-3 w-3 shrink-0 text-emerald-500" />
                      {area}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {agent.languages && agent.languages.length > 0 && (
              <div className="space-y-3">
                <h2 className="text-[11px] font-bold text-slate-400 uppercase tracking-widest">Languages</h2>
                <div className="flex flex-wrap gap-2">
                  {agent.languages.map((lang: string) => (
                    <span
                      key={lang}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white border border-slate-200 text-sm font-semibold text-slate-600"
                    >
                      <Globe className="h-3 w-3 shrink-0 text-slate-400" />
                      {lang}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Listings */}
            <div className="space-y-5">
              <div>
                <h2 className="text-xl font-extrabold text-slate-900 tracking-tight">
                  {listings.length > 0 ? `Listings by ${agent.name.split(' ')[0]}` : 'Current Hostels'}
                </h2>
                {listings.length > 0 && (
                  <p className="text-sm text-slate-400 font-medium mt-0.5">
                    {listings.length} active {listings.length === 1 ? 'listing' : 'listings'}
                  </p>
                )}
              </div>

              {listings.length > 0 ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
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
                        className="group flex flex-col bg-white border border-slate-100 rounded-2xl overflow-hidden hover:border-slate-200 hover:shadow-lg hover:shadow-slate-100/80 transition-all duration-300"
                      >
                        <div className="relative aspect-[4/3] overflow-hidden bg-slate-50">
                          {imageUrl ? (
                            <Image
                              src={imageUrl}
                              alt={`${item.title} — student hostel`}
                              fill
                              className="object-cover transition-transform duration-500 group-hover:scale-[1.04]"
                              sizes="(max-width: 640px) 100vw, 50vw"
                            />
                          ) : (
                            <div className="flex h-full items-center justify-center text-xs font-bold uppercase tracking-wider text-slate-300">
                              No image
                            </div>
                          )}
                          <div className="absolute top-3 right-3 bg-white/95 backdrop-blur-sm px-2.5 py-1 rounded-lg text-xs font-bold shadow-sm text-slate-900">
                            KES {item.price.toLocaleString()}
                            <span className="font-medium text-slate-400">/mo</span>
                          </div>
                        </div>
                        <div className="p-4 flex-1">
                          <div className="flex items-center gap-1 text-slate-400 text-[10px] font-bold mb-1.5 uppercase tracking-wider">
                            <MapPin className="h-3 w-3 shrink-0" />
                            <span className="truncate">{item.location}</span>
                          </div>
                          <h3 className="font-bold text-[15px] text-slate-900 line-clamp-1 group-hover:text-emerald-600 transition-colors">
                            {item.title}
                          </h3>
                          <p className="text-slate-400 text-xs line-clamp-2 mt-1 leading-relaxed">
                            {item.description}
                          </p>
                        </div>
                      </Link>
                    );
                  })}
                </div>
              ) : (
                <div className="text-center py-16 bg-slate-50/80 border border-slate-100 rounded-2xl">
                  <div className="text-3xl mb-3">🏠</div>
                  <p className="text-slate-500 font-semibold">No active listings at the moment</p>
                  <p className="text-slate-400 text-sm mt-1">Check back later or contact the agent directly.</p>
                </div>
              )}
            </div>
          </div>

          {/* ── Sidebar (1/3) ─────────────────────── */}
          <aside className="lg:col-span-1">
            <div className="lg:sticky lg:top-24 space-y-4">
              <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
                <ShareAgentProfile name={agent.name} url={`/agents/${slug}`} shortName={campusShortName} />
              </div>

              {listings.length > 0 && (
                <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
                  <div className="px-5 pt-4 pb-3 border-b border-slate-50">
                    <h3 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Summary</h3>
                  </div>
                  <div className="px-5 py-4 space-y-3.5">
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-slate-500">Active listings</span>
                      <span className="text-sm font-bold text-slate-900 tabular-nums">{listings.length}</span>
                    </div>
                    {agent.helping_since && (
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-slate-500">Experience</span>
                        <span className="text-sm font-bold text-slate-900">
                          {new Date().getFullYear() - agent.helping_since}+ yrs
                        </span>
                      </div>
                    )}
                    {agent.service_areas && (
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-slate-500">Areas covered</span>
                        <span className="text-sm font-bold text-slate-900 tabular-nums">{agent.service_areas.length}</span>
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
