import { createClient } from '@/lib/supabase/server';
import { isAdminUser } from '@/lib/utils/admin';
import { redirect } from 'next/navigation';
import RegionsClient from './regions-client';
import { supabaseAdmin } from '@/lib/supabase/admin';

export const metadata = {
  title: 'Regions Management | Rumia Admin',
};

export default async function AdminRegionsPage() {
  const supabase = await createClient();
  const { data: { user }, error: userError } = await supabase.auth.getUser();

  if (userError || !user) {
    redirect('/auth/login');
  }

  const isAdmin = await isAdminUser(supabase, user.id);
  if (!isAdmin) {
    redirect('/dashboard');
  }

  // Fetch regions
  const { data: regions, error: regionsError } = await supabaseAdmin
    .from('regions')
    .select('*')
    .order('name');

  if (regionsError) {
    console.error('Error fetching regions:', regionsError);
  }

  // Fetch campuses to map to regions
  const { data: campuses, error: campusesError } = await supabaseAdmin
    .from('campuses')
    .select('id, name, region_id');

  if (campusesError) {
    console.error('Error fetching campuses:', campusesError);
  }

  return <RegionsClient regions={regions || []} campuses={campuses || []} />;
}
