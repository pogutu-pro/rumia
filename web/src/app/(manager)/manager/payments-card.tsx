'use client';

import { useState } from 'react';
import { Loader2, Save, Wallet, MessageSquareText } from 'lucide-react';
import { toast } from 'sonner';
import { updateCampusSettingsAction } from '@/app/actions/campus-settings';

interface FeeCampus {
  id: string;
  name: string;
  hostel_finding_fee: number | null;
  consultation_fee: number | null;
}

interface PaymentsCardProps {
  campuses: FeeCampus[];
  isSuperAdmin?: boolean;
}

/**
 * Editable Payments & Fees card for the manager overview. Hostel-finding and
 * agent consultation fees live in one place so managers can change either to
 * any amount. The hostel-finding fee is used when a student submits a
 * "Find Me a Hostel" request and is what appears in the WhatsApp message the
 * manager copies from the requests page.
 */
export function PaymentsCard({ campuses, isSuperAdmin = false }: PaymentsCardProps) {
  const [selectedId, setSelectedId] = useState(campuses[0]?.id ?? '');
  const selected = campuses.find((c) => c.id === selectedId) ?? campuses[0];

  const [hostelFee, setHostelFee] = useState<number>(
    selected?.hostel_finding_fee ?? 100,
  );
  const [consultationFee, setConsultationFee] = useState<number>(
    selected?.consultation_fee ?? 0,
  );
  const [saving, setSaving] = useState(false);

  if (!selected && campuses.length === 0) {
    return null;
  }

  const selectCampus = (id: string) => {
    setSelectedId(id);
    const campus = campuses.find((c) => c.id === id);
    if (campus) {
      setHostelFee(campus.hostel_finding_fee ?? 100);
      setConsultationFee(campus.consultation_fee ?? 0);
    }
  };

  const handleSave = async () => {
    if (saving) return;
    setSaving(true);
    try {
      const res = await updateCampusSettingsAction(selectedId, {
        hostel_finding_fee: hostelFee,
        consultation_fee: consultationFee,
      });
      if (!res.success) {
        toast.error(res.error);
      } else {
        toast.success('Payment settings updated.');
      }
    } catch (error: any) {
      toast.error(error?.message || 'Failed to update payment settings.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="bg-white border border-slate-200/80 rounded-2xl p-4 sm:p-6 shadow-xs space-y-5">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div className="space-y-1">
          <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
            <span className="w-8 h-8 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0">
              <Wallet className="h-4 w-4" />
            </span>
            Payments & Fees
          </h3>
          <p className="text-xs text-slate-500 max-w-md">
            Set the hostel-finding service fee and the agent consultation fee
            for your campus.
          </p>
        </div>

        {(campuses.length > 1 || isSuperAdmin) && (
          <select
            value={selectedId}
            onChange={(e) => selectCampus(e.target.value)}
            className="p-2 border border-slate-300 rounded-xl text-sm bg-white focus:ring-2 focus:ring-slate-900"
            aria-label="Select campus"
          >
            {campuses.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        )}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="rounded-xl border border-slate-200/80 bg-slate-50/40 p-3.5 sm:p-4 space-y-3">
          <div className="flex items-center gap-2">
            <Wallet className="h-4 w-4 text-emerald-600 shrink-0" />
            <p className="text-sm font-bold text-slate-900">
              Hostel-Finding Service Fee
            </p>
          </div>
          <p className="text-[11px] text-slate-500 leading-relaxed">
            Charged when a student submits a &quot;Find Me a Hostel&quot;
            request. Shown in the WhatsApp message you send the student.
          </p>
          <div className="flex items-center gap-2">
            <input
              type="number"
              min={0}
              step={1}
              value={hostelFee}
              onChange={(e) => setHostelFee(Number(e.target.value))}
              className="w-full p-2.5 border border-slate-300 rounded-xl text-sm focus:ring-2 focus:ring-slate-900"
            />
            <span className="text-sm font-bold text-slate-500 shrink-0">KSh</span>
          </div>
        </div>

        <div className="rounded-xl border border-slate-200/80 bg-slate-50/40 p-3.5 sm:p-4 space-y-3">
          <div className="flex items-center gap-2">
            <MessageSquareText className="h-4 w-4 text-emerald-600 shrink-0" />
            <p className="text-sm font-bold text-slate-900">
              Agent Consultation Fee
            </p>
          </div>
          <p className="text-[11px] text-slate-500 leading-relaxed">
            Paid by students when contacting a Rumia agent for hostel guidance.
          </p>
          <div className="flex items-center gap-2">
            <input
              type="number"
              min={0}
              step={1}
              value={consultationFee}
              onChange={(e) => setConsultationFee(Number(e.target.value))}
              className="w-full p-2.5 border border-slate-300 rounded-xl text-sm focus:ring-2 focus:ring-slate-900"
            />
            <span className="text-sm font-bold text-slate-500 shrink-0">KSh</span>
          </div>
        </div>
      </div>

      <div className="flex justify-end pt-1">
        <button
          onClick={handleSave}
          disabled={saving}
          className="px-5 h-11 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold flex items-center justify-center gap-2 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {saving ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <Save className="w-4 h-4" />
          )}
          Save Payment Settings
        </button>
      </div>
    </div>
  );
}