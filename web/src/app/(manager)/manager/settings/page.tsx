import { getManagerUser } from '@/app/actions/manager';
import { managerApi } from '@/lib/api/manager';
import { regionsApi } from '@/lib/api/regions';
import { zonesApi } from '@/lib/api/zones';
import { SettingsClient } from './settings-client';

export const metadata = {
  title: 'Campus Settings - Manager',
};

export default async function ManagerSettingsPage() {
  const manager = await getManagerUser();

  if (!manager) {
    return (
      <div className="p-6 bg-rose-50 border border-rose-200 rounded-xl text-rose-800 text-sm">
        Unauthorized access.
      </div>
    );
  }

  const [campuses, regions, allZones] = await Promise.all([
    managerApi.campuses().catch(() => []),
    regionsApi.listServer().catch(() => []),
    zonesApi.listAllServer().catch(() => []),
  ]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900 tracking-tight">
          Campus Settings
        </h1>
        <p className="text-sm text-slate-500">
          Manage campus details, contact information, and zones.
        </p>
      </div>

      <SettingsClient 
        campuses={campuses} 
        isSuperAdmin={manager.context.isSuperAdmin} 
        regions={regions}
        allZones={allZones}
      />
    </div>
  );
}
