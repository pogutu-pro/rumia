import { Metadata } from 'next';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { ReportForm } from './report-form';
import { getCampusBySlug } from '@/lib/data/campuses';

export const revalidate = 86400;

export const metadata: Metadata = {
  title: 'Report a Hostel Concern — Hakikisha',
  description:
    'Report a suspicious hostel listing, wrong phone number, or payment details to Rumia. We review every report within 24 hours and protect student privacy.',
  alternates: { canonical: '/verify/report' },
  openGraph: {
    title: 'Report a Hostel Concern | Rumia',
    description:
      'Help us protect other students. Report suspicious hostels, wrong numbers, or scams.',
    url: '/verify/report',
    siteName: 'Rumia',
    type: 'website',
  },
};

export default async function ReportPage() {
  const campus = await getCampusBySlug('dekut');

  return (
    <div className="min-h-screen bg-[#F7F5F0] pb-[calc(4rem+env(safe-area-inset-bottom))]">
      <div className="container mx-auto px-4 pt-10 sm:pt-16 lg:pt-20">
        {/* Back to verifier */}
        <Link
          href="/verify"
          className="inline-flex items-center gap-1.5 text-sm font-semibold text-[#1B1B18]/50 hover:text-[#1B1B18] transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Verifier
        </Link>

        {/* Header */}
        <div className="mt-8">
          <h1 className="text-2xl font-bold text-[#1B1B18]">
            Report a Concern
          </h1>
          <p className="mt-1 text-sm text-[#1B1B18]/50 max-w-xl">
            Seen something suspicious while verifying? Help us protect other
            students. Every report is reviewed by our team within 24 hours.
          </p>
        </div>

        <div className="mt-8 grid gap-8 lg:grid-cols-[1fr_340px] lg:items-start">
          {/* Form */}
          <div className="min-w-0">
            <ReportForm whatsappNumber={campus.whatsapp_number} />
          </div>

          {/* Sidebar — how it works */}
          <aside className="space-y-4 lg:sticky lg:top-24">
            <div className="rounded-2xl border border-[#1B1B18]/10 bg-white p-5">
              <h2 className="text-sm font-bold text-[#1B1B18]">What happens next</h2>
              <ol className="mt-4 space-y-4">
                <li className="flex gap-3">
                  <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[#1B1B18] text-white text-xs font-bold">
                    1
                  </span>
                  <div>
                    <p className="text-sm font-semibold text-[#1B1B18]">You send the report</p>
                    <p className="mt-0.5 text-xs text-[#1B1B18]/50 leading-relaxed">
                      Opens WhatsApp with your report pre-filled — no account needed.
                    </p>
                  </div>
                </li>
                <li className="flex gap-3">
                  <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[#1B1B18] text-white text-xs font-bold">
                    2
                  </span>
                  <div>
                    <p className="text-sm font-semibold text-[#1B1B18]">We investigate</p>
                    <p className="mt-0.5 text-xs text-[#1B1B18]/50 leading-relaxed">
                      Our team cross-checks the details against official records.
                    </p>
                  </div>
                </li>
                <li className="flex gap-3">
                  <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[#1B1B18] text-white text-xs font-bold">
                    3
                  </span>
                  <div>
                    <p className="text-sm font-semibold text-[#1B1B18]">Community stays safe</p>
                    <p className="mt-0.5 text-xs text-[#1B1B18]/50 leading-relaxed">
                      Verified issues are flagged so other students can avoid them.
                    </p>
                  </div>
                </li>
              </ol>
            </div>

            {/* Trust */}
            <div className="rounded-2xl border border-[#1B1B18]/10 bg-white p-5 space-y-3">
              <p className="text-sm font-semibold text-[#1B1B18]">Your privacy</p>
              <p className="text-xs text-[#1B1B18]/50 leading-relaxed">
                We never share your identity or phone number with the reported party.
                Reports go straight to our support WhatsApp.
              </p>
            </div>

            {/* Official records link */}
            <Link
              href="/verify/records"
              className="flex items-center justify-center gap-2 rounded-2xl border border-[#1B1B18]/10 bg-white px-4 py-4 text-sm font-bold text-[#1B1B18]/70 hover:border-[#1B1B18]/20 hover:text-[#1B1B18] transition-colors"
            >
              Browse official DeKUT records
            </Link>
          </aside>
        </div>
      </div>
    </div>
  );
}
