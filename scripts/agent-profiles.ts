import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const sp = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

async function main() {
  const { data: agents, error: e1 } = await sp.from('agents').select('id, name, slug, phone, user_id, status').order('name');
  console.log('AGENTS:', JSON.stringify(agents, null, 1), '| err:', e1?.message || null);

  const { data: profiles, error: e2 } = await sp.from('profiles').select('id, full_name, role, email').in('role', ['agent']);
  console.log('\nPROFILES role=agent:', JSON.stringify(profiles, null, 1), '| err:', e2?.message || null);
}
main().catch((e) => { console.error(e); process.exit(1); });