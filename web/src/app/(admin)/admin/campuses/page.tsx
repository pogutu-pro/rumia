import { regionsApi } from '@/lib/api/regions';
import { CampusesTableClient } from './campuses-table-client';
import { getAllCampuses } from '@/lib/data/campuses';

export const metadata = {
  title: 'Campuses Management',
};

export default async function AdminCampusesPage() {
  // getAllCampuses falls back to the DeKUT campus when the campuses table is
  // missing or empty, so the admin page always renders something real.
  const [campuses, regions] = await Promise.all([
    getAllCampuses(),
    regionsApi.listServer().catch(() => []),
  ]);

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Campuses</h1>
        <p className="text-sm text-slate-500 mt-1">Manage all campuses and regions</p>
      </div>

      <CampusesTableClient 
        initialCampuses={campuses} 
        regions={regions as any[]} 
      />
    </div>
  );
}