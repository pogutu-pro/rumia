import type { AdminAgent } from '@/types';
import { AgentsTableClient } from './agents-table-client';
import { adminConsoleApi } from '@/lib/api/admin-console';
import { managerApi } from '@/lib/api/manager';

export default async function AgentsPage() {
  const [rows, campusRows] = await Promise.all([
    adminConsoleApi.agents().catch(() => []),
    managerApi.campuses().catch(() => []),
  ]);

  const agents = rows.map((a) => ({
    ...a,
    role: a.role as AdminAgent['role'],
  })) as unknown as AdminAgent[];
  const campuses = campusRows.map((c) => ({ id: c.id, name: c.name }));

  return <AgentsTableClient agents={agents} campuses={campuses} />;
}
