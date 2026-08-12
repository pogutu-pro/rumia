import { supabaseAdmin } from '@/lib/supabase/admin';
import { UsersTableClient } from './users-table-client';

export interface UserRow {
  id: string;
  email: string;
  full_name: string | null;
  avatar_url: string | null;
  phone: string | null;
  role: string;
  created_at: string;
  updated_at: string | null;
  has_agent: boolean;
  agent_name: string | null;
  agent_status: string | null;
  agent_slug: string | null;
}

export default async function UsersPage() {
  const { data: profiles } = await supabaseAdmin
    .from('profiles')
    .select('id, email, full_name, avatar_url, phone, role, created_at, updated_at')
    .order('created_at', { ascending: false });

  const { data: agents } = await supabaseAdmin
    .from('agents')
    .select('user_id, name, status, slug');

  const agentMap = new Map((agents ?? []).map((a: any) => [
    a.user_id,
    { name: a.name, status: a.status, slug: a.slug },
  ]));

  const users: UserRow[] = (profiles ?? []).map((p: any) => {
    const agent = agentMap.get(p.id);
    return {
      id: p.id,
      email: p.email ?? '',
      full_name: p.full_name,
      avatar_url: p.avatar_url,
      phone: p.phone,
      role: p.role ?? 'student',
      created_at: p.created_at ?? '',
      updated_at: p.updated_at,
      has_agent: !!agent,
      agent_name: agent?.name ?? null,
      agent_status: agent?.status ?? null,
      agent_slug: agent?.slug ?? null,
    };
  });

  return <UsersTableClient users={users} />;
}
