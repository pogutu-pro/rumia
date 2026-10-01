import { adminConsoleApi } from '@/lib/api/admin-console';
import { ListingsTableClient } from './listings-table-client';

export default async function ListingsPage() {
  const data = await adminConsoleApi.listingsPage().catch(() => null);

  return (
    <ListingsTableClient
      listings={data?.listings ?? []}
      agents={(data?.agents ?? []).map((a) => ({ id: a.id, name: a.name, status: a.status ?? '' }))}
      lastReorderAt={data?.last_reorder_at ?? null}
      hasCustomOrder={data?.has_custom_order ?? false}
    />
  );
}
