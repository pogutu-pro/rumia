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
  const activeAgents = await publicApi.getSupportTeam({ revalidate }).catch(() => []);

  return (
    <div className="min-h-screen bg-[#F7F5F0] pb-[calc(4rem+env(safe-area-inset-bottom))]">
      <div className="container mx-auto px-4 pt-10 sm:pt-16 lg:pt-20">
        {/* Mobile: owner on top · Desktop: owner left, checker right */}
        <div className="lg:grid lg:grid-cols-[minmax(0,32rem)_minmax(0,32rem)] lg:gap-4 lg:justify-center lg:items-start">
          <div>
            <SupportTeamSection agents={activeAgents} ownerAtTop />
          </div>
          <div className="mt-10 lg:mt-0">
            <HakisaChecker />
          </div>
        </div>

        {/* Customer Support Team below the checker */}
        <SupportTeamSection agents={activeAgents} teamOnly />
      </div>
    </div>
  );
}
