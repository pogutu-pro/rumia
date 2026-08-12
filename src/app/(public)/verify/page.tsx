import { Metadata } from 'next';
import { AgentGrid } from '@/components/agents/agent-grid';
import { supabasePublic } from '@/lib/supabase/public';
import { HakisaChecker } from '@/components/agents/hakisa-checker';
import type { ListingMatchCandidate } from '@/lib/utils/dekut-verification';

export const revalidate = 3600;

export const metadata: Metadata = {
  title: 'Hakikisha — Verify Before You Pay',
  description:
    'Check if a hostel, phone number, or payment details are verified against official DeKUT records before sending money. Fast, free, and confidential.',
  alternates: {
    canonical: '/verify',
  },
  openGraph: {
    title: 'Hakikisha — Verify Before You Pay | Rumia',
    description:
      'Check if a hostel, phone number, or payment details are verified against official DeKUT records before sending money.',
    url: '/verify',
    siteName: 'Rumia',
    type: 'website',
  },
};

export default async function VerifyPage() {
  const [
    { data: rawListings },
    { data: agents },
    { data: agentAnalytics },
  ] = await Promise.all([
    supabasePublic
      .from('listings')
      .select(
        `id, title, landlord_phone, mpesa_details, specific_location, verified, county, area, slug,
      agents ( phone, whatsapp, verified )`,
      )
      .eq('is_active', true),
    supabasePublic
      .from('agents')
      .select('*')
      .eq('status', 'active'),
    supabasePublic.rpc('get_admin_agent_view_analytics'),
  ]);

  const rumiaListings: ListingMatchCandidate[] = (rawListings || []).map(
    (l: any) => ({
      id: l.id,
      title: l.title,
      county: l.county,
      area: l.area,
      slug: l.slug,
      landlord_phone: l.landlord_phone,
      agent_phone: l.agents?.phone,
      agent_whatsapp: l.agents?.whatsapp,
      agent_verified: l.agents?.verified,
      verified: l.verified,
      mpesa_details: l.mpesa_details,
      specific_location: l.specific_location,
    }),
  );

  const viewRank: Record<string, number> = {};
  for (const row of agentAnalytics || []) {
    viewRank[String(row.agent_id)] = Number(row.all_time_count);
  }

  const activeAgents = (agents || [])
    .filter((a: any) => a.status === 'active')
    .map((a: any) => ({
      ...a,
      total_views: viewRank[String(a.id)] || 0,
    }))
    .sort(
      (a: any, b: any) => b.total_views - a.total_views,
    );

  return (
    <div className="min-h-screen bg-[#F7F5F0] pb-[calc(4rem+env(safe-area-inset-bottom))]">
      <div className="container mx-auto px-4 pt-10 sm:pt-16 lg:pt-20">
        {/* Verification Checker */}
        <HakisaChecker rumiaListings={rumiaListings} />

        {/* Hostel Agents (hidden for now) */}
        {/* {activeAgents.length > 0 && (
          <section className="mt-16 border-t border-[#1B1B18]/10 pt-10">
            <h2 className="text-lg font-bold text-[#1B1B18]">
              Hostel Agents
            </h2>
            <p className="mt-1 text-sm text-[#1B1B18]/50">
              {activeAgents.length} agent{activeAgents.length !== 1 ? 's' : ''} helping students find home near DeKUT
            </p>
            <div className="mt-6">
              <AgentGrid agents={activeAgents} />
            </div>
          </section>
        )} */}
      </div>
    </div>
  );
}
