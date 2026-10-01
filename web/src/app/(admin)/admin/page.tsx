import { adminConsoleApi } from '@/lib/api/admin-console';
import { OverviewClient } from './overview-client';

export default async function OverviewPage() {
  const o = await adminConsoleApi.overview().catch(() => null);

  const stats = {
    activeListings: o?.active_listings ?? 0,
    monthlyLeads: o?.monthly_leads ?? 0,
    pendingCommissionsKes: o?.pending_commissions_kes ?? 0,
    activeAgents: o?.active_agents ?? 0,
    totalCampuses: o?.total_campuses ?? 0,
    totalRegions: o?.total_regions ?? 0,
    totalManagers: o?.total_managers ?? 0,
    supportAgents: o?.support_agents ?? 0,
    totalHostels: (o?.official_hostels ?? 0) + (o?.active_listings ?? 0),
  };

  return <OverviewClient stats={stats} />;
}
