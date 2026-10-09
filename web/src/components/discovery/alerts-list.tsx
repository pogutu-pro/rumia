'use client';

import { useEffect, useState } from 'react';
import { BellRing, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { rumia, type AlertRead } from '@/lib/api/rumia';

const WHEN: Record<string, string> = { instant: 'as it happens', daily: 'once a day', weekly: 'once a week' };

/** The saved searches ("alerts") for this browser or the signed-in account, with a way to stop each one. */
export function AlertsList({ reloadKey = 0 }: { reloadKey?: number }) {
  const [alerts, setAlerts] = useState<AlertRead[] | null>(null);

  useEffect(() => {
    let active = true;
    (async () => {
      const { data } = await rumia.GET('/api/v1/discovery/alerts').catch(() => ({ data: undefined }));
      if (active) setAlerts(data ?? []);
    })();
    return () => {
      active = false;
    };
  }, [reloadKey]);

  async function remove(id: string) {
    const before = alerts;
    setAlerts((list) => (list ?? []).filter((a) => a.id !== id));
    const res = await rumia.DELETE('/api/v1/discovery/alerts/{alert_id}', { params: { path: { alert_id: id } } }).catch(() => null);
    if (!res || res.error) {
      setAlerts(before);
      toast.error('Could not remove that alert. Please try again.');
    }
  }

  if (alerts === null || alerts.length === 0) {
    return alerts === null ? null : (
      <p className="text-sm text-slate-500">
        No alerts yet. Search for a place and choose <span className="font-semibold">Notify me</span> to hear when a new one fits.
      </p>
    );
  }

  return (
    <ul className="divide-y divide-slate-100 rounded-2xl border border-slate-200/60 bg-white">
      {alerts.map((a) => (
        <li key={a.id} className="flex items-center gap-3 p-4">
          <BellRing className="h-5 w-5 shrink-0 text-emerald-600" aria-hidden="true" />
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold text-slate-900">{a.label || 'Saved search'}</p>
            <p className="text-xs text-slate-500">
              {a.channel === 'email' ? 'Email' : 'WhatsApp'}, {WHEN[a.frequency] ?? a.frequency}
            </p>
          </div>
          <button
            type="button"
            onClick={() => void remove(a.id)}
            className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-50 hover:text-rose-600"
            aria-label={`Stop alert ${a.label || ''}`.trim()}
          >
            <Trash2 className="h-4 w-4" aria-hidden="true" />
          </button>
        </li>
      ))}
    </ul>
  );
}
