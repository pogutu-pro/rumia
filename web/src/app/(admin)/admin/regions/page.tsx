import { regionsApi } from '@/lib/api/regions';
import { managerApi } from '@/lib/api/manager';
import RegionsClient from './regions-client';

export const metadata = {
  title: 'Regions Management | Rumia Admin',
};

export default async function AdminRegionsPage() {
  const [regions, campuses] = await Promise.all([
    regionsApi.listServer().catch(() => []),
    managerApi.campuses().catch(() => []),
  ]);

  return (
    <RegionsClient
      regions={regions as any[]}
      campuses={campuses.map((c) => ({ id: c.id, name: c.name, region_id: c.region_id ?? '' }))}
    />
  );
}
