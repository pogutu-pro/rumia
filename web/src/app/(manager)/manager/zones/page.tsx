import { getManagerUser } from '@/app/actions/manager';
import { managerApi } from '@/lib/api/manager';
import { zonesApi } from '@/lib/api/zones';
import { ZonesClient } from './zones-client';

export const metadata = {
  title: 'Campus Zones & Tour Pricing - Manager',
};

export default async function ManagerZonesPage() {
  const manager = await getManagerUser();

  if (!manager) {
    return (
      <div className="p-6 bg-rose-50 border border-rose-200 rounded-xl text-rose-800 text-sm">
        Unauthorized access.
      </div>
    );
  }

  const [campusRows, allZones] = await Promise.all([
    managerApi.campuses().catch(() => []),
    zonesApi.listAllServer().catch(() => []),
  ]);
  const campuses = campusRows.map((c) => ({ id: c.id, name: c.name, slug: c.slug }));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900 tracking-tight">
          Campus Zones & Tour Pricing
        </h1>
        <p className="text-sm text-slate-500">
          Define geographical zones and set tour pricing for student hostel bookings.
        </p>
      </div>

      <ZonesClient
        campuses={campuses}
        isSuperAdmin={manager.context.isSuperAdmin}
        allZones={allZones}
      />
    </div>
  );
}
