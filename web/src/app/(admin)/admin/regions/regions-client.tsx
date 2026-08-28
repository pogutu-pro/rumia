'use client';

interface Region {
  id: string;
  name: string;
  slug: string;
}

interface Campus {
  id: string;
  name: string;
  region_id: string;
}

export default function RegionsClient({ regions, campuses }: { regions: Region[]; campuses: Campus[] }) {
  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Regions</h1>
          <p className="text-sm text-slate-500 mt-1">
            Kenya&apos;s 47 counties. Regions are fixed reference data and cannot be edited.
          </p>
        </div>
        <span className="text-xs font-bold px-3 py-1.5 rounded-full bg-slate-100 text-slate-700 tabular-nums">
          {regions.length} Counties
        </span>
      </div>

      {regions.length === 0 ? (
        <div className="text-center text-sm text-slate-500 py-12 border border-dashed border-slate-200 rounded-2xl bg-white">
          No regions found. Counties are seeded during migration.
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {regions.map((region) => {
            const regionCampuses = campuses.filter((c) => c.region_id === region.id);
            return (
              <div key={region.id} className="bg-white border border-slate-200/80 rounded-2xl p-5 shadow-xs hover:border-slate-300 hover:shadow-md transition-all flex flex-col">
                <div className="flex justify-between items-start mb-4">
                  <div>
                    <h2 className="text-lg font-bold text-slate-900">{region.name}</h2>
                    <p className="text-xs text-slate-500 mt-0.5">/{region.slug}</p>
                  </div>
                  <span className="text-xs font-bold px-2.5 py-1 rounded-full bg-slate-100 text-slate-700 tabular-nums">
                    {regionCampuses.length} {regionCampuses.length === 1 ? 'Campus' : 'Campuses'}
                  </span>
                </div>

                <div className="flex-1">
                  {regionCampuses.length > 0 ? (
                    <ul className="text-sm text-slate-600 space-y-1">
                      {regionCampuses.map((c) => (
                        <li key={c.id}>• {c.name}</li>
                      ))}
                    </ul>
                  ) : (
                    <p className="text-sm text-slate-400 italic">No campuses assigned</p>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}