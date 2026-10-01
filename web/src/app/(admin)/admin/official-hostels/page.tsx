import { officialHostelsApi } from '@/lib/api/official-hostels';
import { OfficialHostelsTableClient } from './official-hostels-table-client';
import officialRecordsData from '@/lib/data/dekut-official-records.json';

export default async function OfficialHostelsPage() {
  const overview = await officialHostelsApi.overviewServer().catch(() => null);

  const dbRecords = overview?.official_hostels ?? [];
  let officialHostels = dbRecords;

  // Fallback to the 93 bundled records if the table is empty (static data, not a DB read).
  if (officialHostels.length === 0 && overview) {
    officialHostels = officialRecordsData.map((r: any, idx: number) => ({
      id: `static-${idx}`,
      hostel_name: r.hostel_name,
      zone: r.zone || 'DeKUT',
      contacts: r.contacts || '',
      payments: r.payments || '',
      source: 'DeKUT Official Housing List',
      verified_date: '2026-07-14',
    }));
  }

  const agentListings = overview?.listings ?? [];

  return (
    <OfficialHostelsTableClient
      officialHostels={officialHostels}
      agentListings={agentListings}
      isFromDb={dbRecords.length > 0}
    />
  );
}
