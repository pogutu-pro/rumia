import { sumPendingCommissions } from '@/lib/utils/admin-stats';
import { CommissionsTableClient } from './commissions-table-client';
import { adminConsoleApi } from '@/lib/api/admin-console';

export default async function CommissionsPage() {
  const data = await adminConsoleApi.commissions().catch(() => null);
  const commissions = (data?.commissions ?? []) as any[];
  const agents = (data?.agents ?? []).map((a) => ({ id: a.id, name: a.name }));
  const totalPending = sumPendingCommissions(commissions);
  const totalPaid = data?.total_paid ?? 0;

  return (
    <CommissionsTableClient
      commissions={commissions}
      agents={agents}
      totalPending={totalPending}
      totalPaid={totalPaid}
    />
  );
}
