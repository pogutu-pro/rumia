import { getManagerUser } from '@/app/actions/manager';
import { createClient } from '@/lib/supabase/server';
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

  const supabase = await createClient();
  let campuses: any[] = [];
  
  if (manager.context.isSuperAdmin) {
    const { data } = await supabase.from('campuses').select('id, name, slug').order('name');
    campuses = data || [];
  } else if (manager.context.managedRegionId) {
    const { data } = await supabase.from('campuses').select('id, name, slug').eq('region_id', manager.context.managedRegionId).order('name');
    campuses = data || [];
  } else if (manager.context.managedCampusId) {
    const { data } = await supabase.from('campuses').select('id, name, slug').eq('id', manager.context.managedCampusId);
    campuses = data || [];
  }

  const { data: allZones } = await supabase.from('campus_zones').select('*').order('name');

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
        allZones={allZones || []}
      />
    </div>
  );
}
