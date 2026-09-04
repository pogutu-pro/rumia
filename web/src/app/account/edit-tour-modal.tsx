'use client';

import { useState } from 'react';
import { CalendarCheck, Clock, X, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { updateStudentTourBookingAction } from '@/app/actions/student-tour-bookings';
import type { TourTimeWindow } from '@/types';

interface EditTourModalProps {
  isOpen: boolean;
  onClose: () => void;
  bookingId: string;
  currentDate: string;
  currentTime: TourTimeWindow;
  currentPhone: string;
  onSuccess: () => void;
}

const TIME_OPTIONS: { value: TourTimeWindow; label: string }[] = [
  { value: 'morning', label: 'Morning (8am - 12pm)' },
  { value: 'afternoon', label: 'Afternoon (12pm - 4pm)' },
  { value: 'evening', label: 'Evening (4pm - 7pm)' },
];

const MIN_DATE = new Date(Date.now() + 86400000).toISOString().split('T')[0];

export function EditTourModal({
  isOpen,
  onClose,
  bookingId,
  currentDate,
  currentTime,
  currentPhone,
  onSuccess,
}: EditTourModalProps) {
  const [date, setDate] = useState(currentDate);
  const [time, setTime] = useState<TourTimeWindow>(currentTime);
  const [phone, setPhone] = useState(currentPhone);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  async function handleSave() {
    setSaving(true);
    setError(null);
    const result = await updateStudentTourBookingAction(bookingId, {
      preferred_date: date,
      preferred_time: time,
      phone,
    });
    setSaving(false);
    if (result.success) {
      onSuccess();
      onClose();
    } else {
      setError(result.error);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative bg-white rounded-2xl w-full max-w-md shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
          <div className="flex items-center gap-2">
            <CalendarCheck className="h-4 w-4 text-slate-600" />
            <h2 className="text-sm font-bold text-slate-900">Edit Tour Booking</h2>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-50 transition-colors cursor-pointer"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Body */}
        <div className="px-5 py-5 space-y-4">
          {error && (
            <div className="bg-red-50 border border-red-200 rounded-xl p-3 text-xs text-red-700 font-medium">
              {error}
            </div>
          )}

          <div>
            <label className="block text-xs font-bold text-slate-500 mb-1.5">Preferred Date</label>
            <Input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              min={MIN_DATE}
              className="h-10 text-sm"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-500 mb-1.5">Preferred Time</label>
            <div className="grid grid-cols-3 gap-2">
              {TIME_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  onClick={() => setTime(opt.value)}
                  className={`flex flex-col items-center gap-1 p-3 rounded-xl border-2 text-xs font-semibold transition-all cursor-pointer ${
                    time === opt.value
                      ? 'border-slate-900 bg-slate-900 text-white'
                      : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300'
                  }`}
                >
                  <Clock className="h-4 w-4" />
                  {opt.value.charAt(0).toUpperCase() + opt.value.slice(1)}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-500 mb-1.5">Phone Number</label>
            <Input
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="0712 345 678"
              className="h-10 text-sm"
            />
          </div>
        </div>

        {/* Footer */}
        <div className="px-5 py-4 border-t border-slate-100 flex items-center gap-3">
          <Button
            variant="ghost"
            onClick={onClose}
            disabled={saving}
            className="flex-1 h-10 rounded-xl text-sm font-bold"
          >
            Cancel
          </Button>
          <Button
            onClick={handleSave}
            disabled={saving}
            className="flex-1 h-10 rounded-xl text-sm font-bold bg-slate-900 hover:bg-slate-800"
          >
            {saving ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              'Save Changes'
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}
