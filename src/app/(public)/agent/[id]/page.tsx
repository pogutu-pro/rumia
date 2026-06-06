import { createClient } from '@/lib/supabase/server';
import { notFound } from 'next/navigation';
import { MapPin, Phone, MessageCircle, ArrowLeft, Eye } from 'lucide-react';
import Link from 'next/link';

export const revalidate = 0;

interface PageProps {
  params: Promise<{
    id: string;
  }>;
}

export default async function AgentProfilePage({ params }: PageProps) {
  const { id } = await params;
  const supabase = await createClient();

  // Fetch agent
  const { data: agent, error: agentError } = await supabase
    .from('agents')
    .select('*')
    .eq('id', id)
    .single();

  if (agentError || !agent) {
    notFound();
  }

  // Fetch agent's active listings
  const { data: listingsData } = await supabase
    .from('listings')
    .select(`
      id,
      title,
      description,
      price,
      location,
      is_active,
      listing_images (
        r2_url,
        display_order
      )
    `)
    .eq('agent_id', id)
    .eq('is_active', true)
    .order('id', { ascending: false });

  const listings = (listingsData || []) as any[];

  const cleanPhone = (agent.whatsapp || agent.phone || '').replace(/[^\d+]/g, '');

  return (
    <div className="min-h-screen bg-slate-50/50 py-10">
      <div className="container mx-auto px-4 lg:px-8">
        {/* Back Link */}
        <Link
          href="/browse"
          className="inline-flex items-center gap-1.5 text-sm font-semibold text-slate-500 hover:text-slate-900 transition-colors mb-8"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to listings
        </Link>

        {/* Profile Card */}
        <div className="bg-white rounded-3xl border border-slate-100 shadow-xs p-6 sm:p-8 mb-10">
          <div className="flex flex-col sm:flex-row items-center sm:items-start gap-6 text-center sm:text-left">
            <div className="w-24 h-24 rounded-full bg-emerald-50 text-emerald-700 flex items-center justify-center font-bold text-3xl uppercase border border-emerald-100 shrink-0">
              {agent.name.substring(0, 2)}
            </div>

            <div className="space-y-4 flex-1">
              <div>
                <h1 className="text-3xl font-black text-slate-900 tracking-tight">{agent.name}</h1>
                <p className="text-sm font-bold text-emerald-600 uppercase tracking-wider mt-1">
                  Authorized Property Agent
                </p>
              </div>

              <div className="flex flex-wrap items-center justify-center sm:justify-start gap-4 text-sm text-slate-500 font-semibold">
                {agent.phone && (
                  <span className="flex items-center gap-1.5">
                    <Phone className="h-4 w-4 text-slate-400" />
                    {agent.phone}
                  </span>
                )}
                {agent.whatsapp && (
                  <a
                    href={`https://wa.me/${cleanPhone}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1.5 text-emerald-600 hover:underline"
                  >
                    <MessageCircle className="h-4 w-4 fill-emerald-50/20" />
                    Chat on WhatsApp
                  </a>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Listings Grid */}
        <div className="space-y-6">
          <h2 className="text-2xl font-extrabold text-slate-950 tracking-tight">
            Listings by {agent.name}
          </h2>

          {listings && listings.length > 0 ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
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
                    href={`/listing/${item.id}`}
                    className="group flex flex-col bg-white border border-slate-100 rounded-2xl overflow-hidden hover:shadow-lg transition-all duration-300 h-full"
                  >
                    <div className="relative aspect-4/3 overflow-hidden bg-slate-100">
                      <img
                        src={imageUrl}
                        alt={item.title}
                        className="object-cover w-full h-full transition-transform duration-500 group-hover:scale-105"
                        loading="lazy"
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
                        <span>Agent Profile</span>
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
            <div className="text-center py-20 bg-white border border-slate-100 rounded-2xl">
              <p className="text-slate-400 font-medium">This agent has no active listings.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
