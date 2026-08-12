import { getManagerUser } from '@/app/actions/manager';
import { createClient } from '@/lib/supabase/server';
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

  const supabase = await createClient();
  let campuses = [];
  
  if (manager.context.isSuperAdmin) {
    const { data } = await supabase.from('campuses').select('*').order('name');
    campuses = data || [];
  } else if (manager.context.managedRegionId) {
    const { data } = await supabase.from('campuses').select('*').eq('region_id', manager.context.managedRegionId).order('name');
    campuses = data || [];
  } else if (manager.context.managedCampusId) {
    const { data } = await supabase.from('campuses').select('*').eq('id', manager.context.managedCampusId);
    campuses = data || [];
  }

  const { data: regions } = await supabase.from('regions').select('*').order('name');
  const { data: allZones } = await supabase.from('campus_zones').select('*').order('name');

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
        regions={regions || []}
        allZones={allZones || []}
      />
    </div>
  );
}
