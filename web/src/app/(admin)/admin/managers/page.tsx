import { managerApi } from '@/lib/api/manager';
import { regionsApi } from '@/lib/api/regions';
import ManagersTableClient from './managers-table-client';

export const metadata = {
  title: 'Managers Management | Admin',
};

export default async function ManagersPage() {
  const [staff, campusRows, regionRows] = await Promise.all([
    managerApi.staff().catch(() => []),
    managerApi.campuses().catch(() => []),
    regionsApi.listServer().catch(() => []),
  ]);
  const campuses = campusRows.map((c) => ({ id: c.id, name: c.name }));
  const regions = regionRows.map((r) => ({ id: r.id, name: r.name }));
  // The table reads the embedded campus/region of each manager.
  const managers = staff
    .filter((m) => m.role === 'manager')
    .sort((a, b) => (a.full_name ?? '').localeCompare(b.full_name ?? ''))
    .map((m) => ({
      ...m,
      campuses: campuses.find((c) => c.id === m.managed_campus_id) ?? null,
      regions: regions.find((r) => r.id === m.managed_region_id) ?? null,
    }));

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Managers</h1>
          <p className="text-sm text-slate-500 mt-1">Assign and manage campus and region managers.</p>
        </div>
      </div>

      <div className="bg-white border border-slate-200/80 rounded-2xl shadow-xs overflow-hidden">
        <ManagersTableClient 
          initialManagers={managers as any[]}
          campuses={campuses}
          regions={regions}
        />
      </div>
    </div>
  );
}
