import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

async function main() {
  const { data: roles, error: e1 } = await supabase.from('profiles').select('role, count(*)');
  console.log('ROLE COUNTS by role:', JSON.stringify(roles), '| error:', e1?.message || null);

  const { data: admins, error: e2 } = await supabase
    .from('profiles')
    .select('id, full_name, email, role')
    .in('role', ['admin', 'super_admin', 'manager'])
    .order('full_name');
  console.log('\nADMIN + SUPER_ADMIN + MANAGER PROFILES:', JSON.stringify(admins, null, 2));
  console.log('error:', e2?.message || null);

  const { data: dist, error: e3 } = await supabase.from('profiles').select('role');
  const set = new Set((dist || []).map((r: any) => r.role));
  console.log('\nDISTINCT ROLES PRESENT:', JSON.stringify([...set]));
  console.log('error:', e3?.message || null);

  const { count: agentCount, error: e4 } = await supabase.from('agents').select('*', { count: 'exact', head: true });
  console.log('\nAGENTS COUNT:', agentCount, '| error:', e4?.message || null);

  const { data: profRow, error: e5 } = await supabase.from('profiles').select('id, phone, campus_id, home_campus_id, managed_campus_id, managed_region_id').limit(1);
  console.log('\nPROFILES extended columns data:', JSON.stringify(profRow));
  console.log('PROFILES extended columns error:', e5?.code, e5?.message || null);

  try {
    const { data: user, error: e6 } = await supabase.auth.admin.listUsers({ page: 1, perPage: 1 });
    console.log('\nAUTH ADMIN listUsers error:', e6?.message || null, '| count:', (user && 'users' in user) ? user.users.length : null);
  } catch (err) {
    console.log('\nAUTH ADMIN listUsers THREW:', (err as Error).message);
  }
}

main().catch((e) => { console.error(e); process.exit(1); });