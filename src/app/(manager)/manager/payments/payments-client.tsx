'use client';

import { useState, useTransition } from 'react';
import { Loader2, Save, Wallet, MessageSquareText } from 'lucide-react';
import { toast } from 'sonner';
import { updateCampusSettingsAction } from '@/app/actions/campus-settings';

interface FeeCampus {
  id: string;
  name: string;
  hostel_finding_fee: number | null;
  consultation_fee: number | null;
}

interface PaymentsClientProps {
  campuses: any[];
  isSuperAdmin: boolean;
}

export function PaymentsClient({ campuses, isSuperAdmin }: PaymentsClientProps) {
  const [selectedCampusId, setSelectedCampusId] = useState<string>(
    campuses[0]?.id || '',
  );
  const [isSaving, setIsSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const selectedCampus = campuses.find((c) => c.id === selectedCampusId);

  const [hostelFee, setHostelFee] = useState<number>(
    selectedCampus?.hostel_finding_fee ?? 100,
  );
  const [consultationFee, setConsultationFee] = useState<number>(
    selectedCampus?.consultation_fee ?? 50,
  );

  const handleCampusChange = (id: string) => {
    setSelectedCampusId(id);
    const campus = campuses.find((c) => c.id === id);
    if (campus) {
      setHostelFee(campus.hostel_finding_fee ?? 100);
      setConsultationFee(campus.consultation_fee ?? 50);
    }
    setErrorMsg(null);
    setSuccessMsg(null);
  };

  const handleSave = async () => {
    if (isSaving) return;
    setErrorMsg(null);
    setSuccessMsg(null);
    setIsSaving(true);
    try {
      const res = await updateCampusSettingsAction(selectedCampusId, {
        hostel_finding_fee: hostelFee,
        consultation_fee: consultationFee,
      });
      if (!res.success) {
        setErrorMsg(res.error);
        toast.error(res.error);
      } else {
        setSuccessMsg('Payment settings updated successfully.');
        toast.success('Payment settings updated successfully.');
      }
    } catch (error: any) {
      const msg = error?.message || 'Failed to update payment settings';
      setErrorMsg(msg);
      toast.error(msg);
    } finally {
      setIsSaving(false);
    }
  };

  if (!selectedCampus && campuses.length === 0) {
    return (
      <div className="p-6 bg-slate-50 border border-slate-200 rounded-xl text-slate-600 text-sm">
        No campuses found.
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {errorMsg && (
        <div className="p-3.5 bg-rose-50 border border-rose-200 text-rose-800 text-sm rounded-xl flex items-center gap-2">
          <span className="shrink-0">!</span>
          <span>{errorMsg}</span>
        </div>
      )}

      {successMsg && (
        <div className="p-3.5 bg-emerald-50 border border-emerald-200 text-emerald-800 text-sm rounded-xl">
          {successMsg}
        </div>
      )}

      {(campuses.length > 1 || isSuperAdmin) && (
        <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs">
          <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
            Select Campus
          </label>
          <select
            value={selectedCampusId}
            onChange={(e) => handleCampusChange(e.target.value)}
            className="w-full sm:max-w-md p-2.5 border border-slate-300 rounded-xl text-sm focus:ring-2 focus:ring-slate-900 bg-white"
          >
            {campuses.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Hostel-Finding Service Fee */}
        <div className="bg-white border border-slate-200/80 rounded-2xl p-6 shadow-xs space-y-4">
          <div className="border-b border-slate-100 pb-3">
            <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
              <Wallet className="w-4 h-4 text-emerald-600" />
              Hostel-Finding Service Fee
            </h2>
            <p className="text-xs text-slate-500 mt-1">
              Charged when a student submits a &quot;Find Me a Hostel&quot; request.
            </p>
          </div>

          <div className="space-y-3.5">
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">
                Fee amount (KSh)
              </label>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  min={0}
                  step={1}
                  value={hostelFee}
                  onChange={(e) => setHostelFee(Number(e.target.value))}
                  className="w-full p-2.5 border border-slate-300 rounded-xl text-sm focus:ring-2 focus:ring-slate-900"
                />
                <span className="text-sm font-bold text-slate-500">KSh</span>
              </div>
              <p className="mt-2 text-xs text-slate-500">
                Kept private. Only shown to the student after they submit a request.
              </p>
            </div>
          </div>
        </div>

        {/* Consultation Fee */}
        <div className="bg-white border border-slate-200/80 rounded-2xl p-6 shadow-xs space-y-4">
          <div className="border-b border-slate-100 pb-3">
            <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
              <MessageSquareText className="w-4 h-4 text-emerald-600" />
              Agent Consultation Fee
            </h2>
            <p className="text-xs text-slate-500 mt-1">
              Paid by students when contacting a Rumia agent for hostel guidance.
            </p>
          </div>

          <div className="space-y-3.5">
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">
                Consultation fee (KSh)
              </label>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  min={0}
                  step={1}
                  value={consultationFee}
                  onChange={(e) => setConsultationFee(Number(e.target.value))}
                  className="w-full p-2.5 border border-slate-300 rounded-xl text-sm focus:ring-2 focus:ring-slate-900"
                />
                <span className="text-sm font-bold text-slate-500">KSh</span>
              </div>
              <p className="mt-2 text-xs text-slate-500">
                Displayed in WhatsApp inquiry messages and the contact modal fee disclosure.
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className="flex justify-end pt-4">
        <button
          onClick={handleSave}
          disabled={isSaving}
          className="px-6 py-3 bg-slate-900 hover:bg-slate-800 text-white font-semibold text-sm rounded-xl flex items-center gap-2 transition-colors shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isSaving ? (
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
