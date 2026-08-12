import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { db: { schema: 'supabase_migrations' } },
);

async function main() {
  const { data, error } = await supabase.from('schema_migrations').select('version, name, statements').order('version');
  if (error) {
    console.log('ERROR querying supabase_migrations.schema_migrations:', JSON.stringify(error));
    return;
  }
  console.log('TOTAL MIGRATIONS APPLIED:', data.length);
  for (const m of data) {
    console.log(m.version, '|', m.name ?? '');
  }
}
main().catch((e) => { console.error(e); process.exit(1); });