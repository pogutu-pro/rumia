import { Metadata } from 'next';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import officialRecordsData from '@/lib/data/dekut-official-records.json';
import { OfficialRecordsTable } from './records-table';
import { buildOfficialPhoneIndex, parseOfficialRecord } from '@/lib/utils/dekut-verification';
import type { OfficialDeKutRecord } from '@/lib/utils/dekut-verification';

export const revalidate = 3600;

export const metadata: Metadata = {
  title: 'Official DeKUT Hostel Records — Hakikisha',
  description:
    'Browse all 93 verified hostel records from the official DeKUT housing list. Search by hostel name, zone, or payment details before you send money.',
  alternates: { canonical: '/verify/records' },
  openGraph: {
    title: 'Official DeKUT Hostel Records | Rumia',
    description:
      'Search the complete official DeKUT hostel housing list before you pay a deposit.',
    url: '/verify/records',
    siteName: 'Rumia',
    type: 'website',
  },
};

export default async function OfficialRecordsPage() {
  const parsed: OfficialDeKutRecord[] = officialRecordsData.map((record) =>
    parseOfficialRecord(record),
  );
  const phoneIndex = buildOfficialPhoneIndex(parsed);

  const zones = Array.from(
    new Set(officialRecordsData.map((r: any) => (r.zone || '').toUpperCase()).filter(Boolean)),
  ).sort();

  const sharedContactPhones = Array.from(phoneIndex.entries()).filter(
    ([, hostels]) => hostels.length > 1,
  );

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
            Official DeKUT Hostel Records
          </h1>
          <p className="mt-1 text-sm text-[#1B1B18]/50 max-w-xl">
            Every hostel below is sourced from the DeKUT official student housing
            list. Cross-check the number you were given before sending any deposit.
          </p>
        </div>

        {/* Stats */}
        <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <div className="rounded-2xl border border-[#1B1B18]/10 bg-white p-4">
            <p className="text-2xl font-bold text-[#1B1B18]">{officialRecordsData.length}</p>
            <p className="mt-0.5 text-xs font-medium text-[#1B1B18]/50">Hostels listed</p>
          </div>
          <div className="rounded-2xl border border-[#1B1B18]/10 bg-white p-4">
            <p className="text-2xl font-bold text-[#1B1B18]">{zones.length}</p>
            <p className="mt-0.5 text-xs font-medium text-[#1B1B18]/50">Zones</p>
          </div>
          <div className="rounded-2xl border border-[#1B1B18]/10 bg-white p-4">
            <p className="text-2xl font-bold text-[#1B1B18]">{sharedContactPhones.length}</p>
            <p className="mt-0.5 text-xs font-medium text-[#1B1B18]/50">Shared contacts</p>
          </div>
          <div className="rounded-2xl border border-[#1B1B18]/10 bg-white p-4">
            <p className="text-2xl font-bold text-[#1B1B18]">14 Jul</p>
            <p className="mt-0.5 text-xs font-medium text-[#1B1B18]/50">Last updated</p>
          </div>
        </div>

        {/* Records table */}
        <div className="mt-8">
          <OfficialRecordsTable records={officialRecordsData} />
        </div>
      </div>
    </div>
  );
}
