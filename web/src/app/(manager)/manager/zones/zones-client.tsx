'use client';

import { useState, useTransition } from 'react';
import { MapPin, Plus, Edit2, Trash2, Loader2, AlertCircle } from 'lucide-react';
import { createZoneAction, updateZoneAction, deleteZoneAction } from '@/app/actions/zones';

interface ZonesClientProps {
  campuses: any[];
  isSuperAdmin: boolean;
  allZones: any[];
}

export function ZonesClient({ campuses, isSuperAdmin, allZones }: ZonesClientProps) {
  const [selectedCampusId, setSelectedCampusId] = useState<string>(campuses[0]?.id || '');
  const [isPending, startTransition] = useTransition();
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Filter zones for selected campus
  const campusZones = allZones.filter((z) => z.campus_id === selectedCampusId);
  const [editingZone, setEditingZone] = useState<any | null>(null);
  const [zoneForm, setZoneForm] = useState({ name: '', full_search_price: 500, distance_category: 'walking-500m' });

  const handleSaveZone = () => {
    setErrorMsg(null);
    setSuccessMsg(null);
    startTransition(async () => {
      if (editingZone?.id) {
        const res = await updateZoneAction(editingZone.id, zoneForm.name, zoneForm.full_search_price, zoneForm.distance_category);
        if (!res.success) {
          setErrorMsg(res.error);
        } else {
          setEditingZone(null);
          setSuccessMsg('Zone updated successfully.');
        }
      } else {
        const res = await createZoneAction(selectedCampusId, zoneForm.name, zoneForm.full_search_price, zoneForm.distance_category);
        if (!res.success) {
          setErrorMsg(res.error);
        } else {
          setEditingZone(null);
          setSuccessMsg('Zone created successfully.');
        }
      }
    });
  };

  const handleDeleteZone = (id: string) => {
    if (!confirm('Are you sure you want to delete this zone?')) return;
    setErrorMsg(null);
    setSuccessMsg(null);
    startTransition(async () => {
      const res = await deleteZoneAction(id);
      if (!res.success) {
        setErrorMsg(res.error);
      } else {
        setSuccessMsg('Zone deleted successfully.');
      }
    });
  };

  if (campuses.length === 0) {
    return (
      <div className="text-center text-sm text-slate-500 py-12 border border-dashed border-slate-200 rounded-2xl bg-white">
        No assigned campuses found to manage zones.
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Campus Selector */}
      {campuses.length > 1 && (
        <div className="bg-white p-4 rounded-2xl border border-slate-200/80 flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-xs">
          <div className="flex-1">
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
              Select Campus Context
            </label>
            <select
              value={selectedCampusId}
              onChange={(e) => {
                setSelectedCampusId(e.target.value);
                setErrorMsg(null);
                setSuccessMsg(null);
              }}
              className="w-full sm:max-w-md p-2.5 border border-slate-300 rounded-xl text-sm focus:ring-2 focus:ring-slate-900 bg-white"
            >
              {campuses.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>
        </div>
      )}

      {errorMsg && (
        <div className="p-3.5 bg-rose-50 border border-rose-200 text-rose-800 text-sm rounded-xl flex items-center gap-2">
          <AlertCircle className="h-4 w-4 shrink-0 text-rose-600" />
          <span>{errorMsg}</span>
        </div>
      )}

      {successMsg && (
        <div className="p-3.5 bg-emerald-50 border border-emerald-200 text-emerald-800 text-sm rounded-xl">
          {successMsg}
        </div>
      )}

      {/* Main Zones Card Container */}
      <div className="bg-white border border-slate-200/80 rounded-2xl p-6 shadow-xs space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
              <MapPin className="w-5 h-5 text-emerald-600" />
              Configured Zones ({campusZones.length})
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Hostel areas and tour pricing for {campuses.find((c) => c.id === selectedCampusId)?.name || 'Campus'}
            </p>
          </div>
          <button
            onClick={() => {
              setEditingZone({ isNew: true });
              setZoneForm({ name: '', full_search_price: 500, distance_category: 'walking-500m' });
            }}
            className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white font-semibold text-xs rounded-xl flex items-center gap-1.5 transition-colors shadow-xs"
          >
            <Plus className="w-4 h-4" /> Add Zone
          </button>
        </div>

        {campusZones.length === 0 ? (
          <div className="text-center text-sm text-slate-500 py-12 border border-dashed border-slate-200 rounded-xl">
            No zones configured for this campus yet. Click &quot;Add Zone&quot; above to create one.
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 pt-2">
            {campusZones.map((zone) => (
              <div
                key={zone.id}
                className="p-4 border border-slate-200/80 bg-slate-50/50 hover:bg-white hover:border-slate-300 rounded-2xl transition-all flex flex-col justify-between space-y-3"
              >
                <div>
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-slate-900 text-sm">{zone.name}</span>
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-100">
                      Active
                    </span>
                  </div>
                  <div className="text-xs text-slate-500 mt-1">
                    {zone.distance_category ? `Distance: ${zone.distance_category}` : 'Geographical Area'}
                  </div>
                  <div className="text-lg font-extrabold text-slate-900 mt-2">
                    KSh {zone.full_search_price.toLocaleString()}{' '}
                    <span className="text-[11px] font-medium text-slate-500">/ tour</span>
                  </div>
                </div>

                <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-200/60">
                  <button
                    onClick={() => {
                      setEditingZone(zone);
                      setZoneForm({
                        name: zone.name,
                        full_search_price: zone.full_search_price,
                        distance_category: zone.distance_category || 'walking-500m',
                      });
                    }}
                    className="px-2.5 py-1 text-xs font-medium text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition-colors flex items-center gap-1"
                  >
                    <Edit2 className="w-3.5 h-3.5" /> Edit
                  </button>
                  <button
                    onClick={() => handleDeleteZone(zone.id)}
                    disabled={isPending}
                    className="px-2.5 py-1 text-xs font-medium text-rose-600 hover:bg-rose-50 rounded-lg transition-colors disabled:opacity-50 flex items-center gap-1"
                  >
                    <Trash2 className="w-3.5 h-3.5" /> Delete
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Zone Edit Modal */}
      {editingZone && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-sm w-full p-6 space-y-4 shadow-xl">
            <h3 className="text-lg font-bold text-slate-900">
              {editingZone.isNew ? 'Create Campus Zone' : 'Edit Zone'}
            </h3>

            <div className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">Zone / Area Name</label>
                <input
                  type="text"
                  value={zoneForm.name}
                  onChange={(e) => setZoneForm({ ...zoneForm, name: e.target.value })}
                  placeholder="e.g. Near Gate A, Boma, Town Center"
                  className="w-full p-2.5 border border-slate-300 rounded-xl text-sm focus:ring-2 focus:ring-slate-900"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">Zone Tour Price (KSh)</label>
                <input
                  type="number"
                  value={zoneForm.full_search_price}
                  onChange={(e) => setZoneForm({ ...zoneForm, full_search_price: Number(e.target.value) })}
                  className="w-full p-2.5 border border-slate-300 rounded-xl text-sm focus:ring-2 focus:ring-slate-900"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-4">
              <button
                onClick={() => setEditingZone(null)}
                className="px-4 py-2 border border-slate-300 rounded-xl text-xs font-semibold text-slate-700 hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveZone}
                disabled={isPending || !zoneForm.name.trim()}
                className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white font-semibold text-xs rounded-xl disabled:opacity-50 flex items-center gap-2"
              >
                {isPending && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                Save Zone
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
