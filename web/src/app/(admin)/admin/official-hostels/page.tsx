import { createClient } from '@/lib/supabase/server';
import { OfficialHostelsTableClient } from './official-hostels-table-client';
import officialRecordsData from '@/lib/data/dekut-official-records.json';

export default async function OfficialHostelsPage() {
  const supabase = await createClient();

  const [{ data: dbRecords, error: dbError }, { data: agentListingsRaw }] =
    await Promise.all([
      (supabase as any)
        .from('dekut_official_hostels')
        .select('*')
        .order('hostel_name', { ascending: true }),
      (supabase as any)
        .from('listings')
        .select(`
          id, title, location, price, is_active, verified, is_full, created_at, landlord_phone, mpesa_details, specific_location, county, area, slug,
          agents ( id, name, phone, whatsapp, verified )
        `)
        .order('created_at', { ascending: false }),
    ]);

  let officialHostels = dbRecords || [];

  // Fallback to 93 static records if DB is empty
  if (officialHostels.length === 0 && !dbError) {
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

  const agentListings = (agentListingsRaw || []).map((l: any) => ({
    id: l.id,
    title: l.title,
    location: l.location || l.area || 'DeKUT',
    price: l.price,
    is_active: l.is_active,
    verified: l.verified || (Array.isArray(l.agents) ? l.agents[0]?.verified : l.agents?.verified) || false,
    is_full: l.is_full ?? false,
    created_at: l.created_at,
    landlord_phone: l.landlord_phone || '',
    mpesa_details: l.mpesa_details || '',
    specific_location: l.specific_location || '',
    county: l.county || 'nyeri',
    area: l.area || 'dekut',
    slug: l.slug,
    agent_name: Array.isArray(l.agents) ? l.agents[0]?.name || 'Agent' : l.agents?.name || 'Agent',
    agent_phone: Array.isArray(l.agents) ? l.agents[0]?.phone || '' : l.agents?.phone || '',
    agent_whatsapp: Array.isArray(l.agents) ? l.agents[0]?.whatsapp || '' : l.agents?.whatsapp || '',
  }));

  return (
    <OfficialHostelsTableClient
      officialHostels={officialHostels}
      agentListings={agentListings}
      isFromDb={dbRecords && dbRecords.length > 0}
    />
  );
}
