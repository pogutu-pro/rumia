import { UsersTableClient } from './users-table-client';
import { adminConsoleApi } from '@/lib/api/admin-console';

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
  const users: UserRow[] = (await adminConsoleApi.users().catch(() => [])).map((u) => ({
    ...u,
    created_at: u.created_at ?? '',
  }));

  return <UsersTableClient users={users} />;
}
