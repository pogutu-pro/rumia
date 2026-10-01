import { TransfersTableClient } from './transfers-table-client';
import { adminConsoleApi } from '@/lib/api/admin-console';

export default async function TransfersPage() {
  const transfers = await adminConsoleApi.transfers().catch(() => []);

  return <TransfersTableClient transfers={transfers} />;
}
