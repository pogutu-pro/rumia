import { Metadata } from 'next';
import { SupportTeamSection } from '@/components/agents/support-team-section';
import { supabasePublic } from '@/lib/supabase/public';
import { HakisaChecker } from '@/components/agents/hakisa-checker';
import type { ListingMatchCandidate } from '@/lib/utils/dekut-verification';

export const revalidate = 86400;

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
  const [{ data: rawListings }, { data: agents }] = await Promise.all([
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
      .eq('status', 'active')
      .eq('is_support', true)
      .order('support_rank'),
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

  const activeAgents = (agents || []).filter((a: any) => a.status === 'active');

  return (
    <div className="min-h-screen bg-[#F7F5F0] pb-[calc(4rem+env(safe-area-inset-bottom))]">
      <div className="container mx-auto px-4 pt-10 sm:pt-16 lg:pt-20">
        {/* Verification Checker */}
        <HakisaChecker rumiaListings={rumiaListings} />

        {/* Customer Support Team (admin-curated) */}
        <SupportTeamSection agents={activeAgents} />
      </div>
    </div>
  );
}
