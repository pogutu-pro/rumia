'use client';

import { useState } from 'react';
import { Loader2, Save, Wallet } from 'lucide-react';
import { toast } from 'sonner';
import { updateCampusSettingsAction } from '@/app/actions/campus-settings';

interface FeeCampus {
  id: string;
  name: string;
  hostel_finding_fee: number | null;
}

export function HostelFindingFeeCard({ campuses }: { campuses: FeeCampus[] }) {
  const [items, setItems] = useState<FeeCampus[]>(campuses);
  const [selectedId, setSelectedId] = useState(campuses[0]?.id ?? '');
  const selected = items.find((c) => c.id === selectedId) ?? items[0];
  const [fee, setFee] = useState<number>(selected?.hostel_finding_fee ?? 100);
  const [saving, setSaving] = useState(false);

  const selectCampus = (id: string) => {
    setSelectedId(id);
    const campus = items.find((c) => c.id === id);
    setFee(campus?.hostel_finding_fee ?? 100);
  };

  const handleSave = async () => {
    if (!selectedId || saving) return;
    const value = Number(fee);
    if (!Number.isFinite(value) || value < 0) {
      toast.error('Enter a valid fee amount.');
      return;
    }
    setSaving(true);
    const res = await updateCampusSettingsAction(selectedId, {
      hostel_finding_fee: value,
    });
    setSaving(false);

    if (!res.success) {
      toast.error(res.error);
      return;
    }

    setItems((prev) =>
      prev.map((c) =>
        c.id === selectedId ? { ...c, hostel_finding_fee: value } : c,
      ),
    );
    toast.success('Hostel-finding service fee updated.');
  };

  if (!selected) return null;

  return (
    <div className="bg-white border border-slate-200 rounded-2xl p-4 sm:p-5 shadow-xs space-y-4">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div className="space-y-1">
          <h3 className="text-sm sm:text-base font-bold text-slate-900 flex items-center gap-2">
            <span className="w-8 h-8 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0">
              <Wallet className="h-4 w-4" />
            </span>
            Hostel-Finding Service Fee
          </h3>
          <p className="text-xs text-slate-500">
            The fee charged for a &quot;Find Me a Hostel&quot; request. It is
            kept private and only shown to the student after they submit a
            request.
          </p>
        </div>

        {items.length > 1 && (
          <select
            value={selectedId}
            onChange={(e) => selectCampus(e.target.value)}
            className="p-2 border border-slate-300 rounded-xl text-sm bg-white focus:ring-2 focus:ring-slate-900"
          >
            {items.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        )}
      </div>

      <div className="flex flex-col sm:flex-row sm:items-end gap-3">
        <div className="flex-1">
          <label className="block text-[11px] font-bold uppercase tracking-wide text-slate-500 mb-1.5">
            Fee amount (KSh)
          </label>
          <input
            type="number"
            min={0}
            step={1}
            value={fee}
            onChange={(e) => setFee(Number(e.target.value))}
            className="w-full p-2.5 border border-slate-300 rounded-xl text-sm focus:ring-2 focus:ring-slate-900"
          />
        </div>
        <button
          onClick={handleSave}
          disabled={saving}
          className="px-5 h-11 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold flex items-center justify-center gap-2 transition-colors disabled:opacity-50 disabled:cursor-not-allowed shrink-0"
        >
          {saving ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <Save className="w-4 h-4" />
          )}
          Save Fee
        </button>
      </div>
    </div>
  );
}
