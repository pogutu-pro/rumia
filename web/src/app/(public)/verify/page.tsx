import { Metadata } from 'next';
import { SupportTeamSection } from '@/components/agents/support-team-section';
import { publicApi } from '@/lib/api/public';
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
  const [candidates, activeAgents] = await Promise.all([
    publicApi.getVerifyCandidates({ revalidate }).catch(() => []),
    publicApi.getSupportTeam({ revalidate }).catch(() => []),
  ]);

  // Already in the checker's shape (FastAPI returns the flattened candidate).
  const rumiaListings: ListingMatchCandidate[] = candidates.map((c) => ({
    id: c.id,
    title: c.title,
    county: c.county,
    area: c.area,
    slug: c.slug,
    landlord_phone: c.landlord_phone,
    agent_phone: c.agent_phone,
    agent_whatsapp: c.agent_whatsapp,
    agent_verified: c.agent_verified,
    verified: c.verified,
    mpesa_details: c.mpesa_details,
    specific_location: c.specific_location,
  })) as ListingMatchCandidate[];

  return (
    <div className="min-h-screen bg-[#F7F5F0] pb-[calc(4rem+env(safe-area-inset-bottom))]">
      <div className="container mx-auto px-4 pt-10 sm:pt-16 lg:pt-20">
        {/* Mobile: owner on top · Desktop: owner left, checker right */}
        <div className="lg:grid lg:grid-cols-[minmax(0,32rem)_minmax(0,32rem)] lg:gap-4 lg:justify-center lg:items-start">
          <div>
            <SupportTeamSection agents={activeAgents} ownerAtTop />
          </div>
          <div className="mt-10 lg:mt-0">
            <HakisaChecker rumiaListings={rumiaListings} />
          </div>
        </div>

        {/* Customer Support Team below the checker */}
        <SupportTeamSection agents={activeAgents} teamOnly />
      </div>
    </div>
  );
}
