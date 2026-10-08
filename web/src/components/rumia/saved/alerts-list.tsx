'use client';

import { useEffect, useState } from 'react';
import { Bell, Trash2 } from 'lucide-react';
import Link from 'next/link';
import { rumia, type AlertRead } from '@/lib/api/rumia';

const FREQUENCY_LABEL: Record<string, string> = { instant: 'Immediately', daily: 'Daily', weekly: 'Weekly' };

/**
 * Saved searches (alerts) for this browser or account: list, delete, and a pointer to Explore to add a
 * new one ("Add alert from your current search" keeps the intent on the search that created it).
 */
export function AlertsList() {
  const [alerts, setAlerts] = useState<AlertRead[] | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    let active = true;
    (async () => {
      const { data } = await rumia.GET('/api/v1/discovery/alerts').catch(() => ({ data: undefined }));
      if (!active) return;
      if (!data) setError(true);
      else setAlerts(data);
    })();
    return () => {
      active = false;
    };
  }, []);

  async function remove(alert: AlertRead) {
    setAlerts((prev) => (prev ? prev.filter((a) => a.id !== alert.id) : prev));
    const res = await rumia
      .DELETE('/api/v1/discovery/alerts/{alert_id}', { params: { path: { alert_id: alert.id } } })
      .catch(() => null);
    if (!res || res.error) {
      // Restore on failure so nobody thinks it is gone.
      setAlerts((prev) => (prev ? [...prev, alert] : prev));
    }
  }

  if (error) {
    return (
      <div role="alert" className="rounded-rum-media border border-rum-line bg-rum-raised p-6 text-center">
        <p className="text-base font-semibold">We could not load your alerts.</p>
        <p className="mt-1 text-sm text-rum-muted">Check your connection and try again.</p>
      </div>
    );
  }

  if (!alerts) {
    return (
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        {Array.from({ length: 2 }).map((_, i) => (
          <div key={i} className="animate-pulse rounded-rum-media border border-rum-line p-4" aria-hidden="true">
            <div className="h-4 w-2/3 rounded bg-rum-sunken" />
            <div className="mt-2 h-4 w-1/3 rounded bg-rum-sunken" />
          </div>
        ))}
      </div>
    );
  }

  if (alerts.length === 0) {
    return (
      <div className="rounded-rum-media border border-rum-line bg-rum-raised p-6 text-center">
        <Bell className="mx-auto h-6 w-6 text-rum-muted" aria-hidden="true" />
        <p className="mt-2 text-base font-semibold">No alerts yet</p>
        <p className="mt-1 text-sm text-rum-muted">Run a search on Explore, then tell it to let you know when something new matches.</p>
        <Link href="/" className="mt-4 inline-flex min-h-11 items-center rounded-rum-control bg-rum-accent px-5 text-base font-semibold text-rum-on-accent">
          Search places
        </Link>
      </div>
    );
  }

  return (
    <ul className="space-y-3">
      {alerts.map((a) => (
        <li key={a.id} className="flex items-center gap-3 rounded-rum-media border border-rum-line bg-rum-raised px-4 py-3">
          <Bell className="h-5 w-5 shrink-0 text-rum-accent" aria-hidden="true" />
          <div className="min-w-0 flex-1">
            <p className="truncate text-base font-medium">{a.label ?? 'Your search'}</p>
            <p className="text-sm text-rum-muted">
              {a.channel === 'email' ? 'Email' : 'WhatsApp'} · {FREQUENCY_LABEL[a.frequency] ?? a.frequency}
              {!a.active && ' · Off'}
            </p>
          </div>
          <button
            type="button"
            onClick={() => remove(a)}
            aria-label={`Delete alert "${a.label ?? 'Your search'}"`}
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-rum-danger hover:bg-rum-sunken"
          >
            <Trash2 className="h-5 w-5" aria-hidden="true" />
          </button>
        </li>
      ))}
    </ul>
  );
}