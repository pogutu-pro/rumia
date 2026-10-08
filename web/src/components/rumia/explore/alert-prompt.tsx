'use client';

import { useState } from 'react';
import { Bell } from 'lucide-react';
import { rumia } from '@/lib/api/rumia';
import { track } from '@/lib/events';
import { toApiQuery, type ExploreFilters } from '@/lib/rumia/explore-params';

/** "Tell me when something matches": the reason to give an email or phone number, said plainly. */
export function AlertPrompt({ filters, label }: { filters: ExploreFilters; label: string }) {
  const [open, setOpen] = useState(false);
  const [channel, setChannel] = useState<'email' | 'whatsapp'>('email');
  const [contact, setContact] = useState('');
  const [state, setState] = useState<'idle' | 'sending' | 'done' | 'error'>('idle');
  const [message, setMessage] = useState('');

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setState('sending');
    const { limit: _l, cursor: _c, ...intent } = toApiQuery(filters);
    const res = await rumia
      .POST('/api/v1/discovery/alerts', {
        body: { intent: { ...intent, market: 'nyeri' }, label, channel, email: channel === 'email' ? contact : null, phone: channel === 'whatsapp' ? contact : null, frequency: 'daily' },
      })
      .catch(() => null);
    if (res && !res.error) {
      track('alert_created', { surface: 'explore', props: { channel } });
      setState('done');
    } else {
      const err = res?.error as { detail?: { message?: string } } | undefined;
      setMessage(err?.detail?.message ?? 'Could not save this. Check the details and try again.');
      setState('error');
    }
  }

  if (state === 'done') {
    return (
      <p role="status" className="rounded-rum-media bg-rum-sunken p-4 text-sm text-rum-text">
        Saved. {channel === 'email' ? "We'll email you" : "We'll message you on WhatsApp"} when a new place matches.
      </p>
    );
  }

  return (
    <div className="rounded-rum-media border border-rum-line bg-rum-raised p-4">
      {!open ? (
        <button type="button" onClick={() => setOpen(true)} className="flex min-h-11 w-full items-center gap-2 text-left text-base font-semibold text-rum-text">
          <Bell className="h-5 w-5 text-rum-accent" aria-hidden="true" />
          Tell me when something matches
        </button>
      ) : (
        <form onSubmit={submit} className="space-y-3">
          <p className="text-base font-semibold">We will tell you when a new place matches “{label}”.</p>
          <div role="group" aria-label="How to reach you" className="inline-flex rounded-full border border-rum-line p-1 text-sm">
            {(['email', 'whatsapp'] as const).map((c) => (
              <button key={c} type="button" aria-pressed={channel === c} onClick={() => setChannel(c)} className={`min-h-9 rounded-full px-4 font-medium ${channel === c ? 'bg-rum-accent text-rum-on-accent' : ''}`}>
                {c === 'email' ? 'Email' : 'WhatsApp'}
              </button>
            ))}
          </div>
          <label className="block text-sm">
            <span className="text-rum-muted">{channel === 'email' ? 'Your email' : 'Your WhatsApp number'}</span>
            <input
              type={channel === 'email' ? 'email' : 'tel'}
              inputMode={channel === 'email' ? 'email' : 'tel'}
              autoComplete={channel === 'email' ? 'email' : 'tel'}
              value={contact}
              onChange={(e) => setContact(e.target.value)}
              required
              placeholder={channel === 'email' ? 'you@example.com' : '0712 345 678'}
              className="mt-1 min-h-12 w-full rounded-rum-control border border-rum-line bg-rum-surface px-3 text-base"
            />
          </label>
          {channel === 'whatsapp' && <p className="text-xs text-rum-muted">WhatsApp alerts start once we connect WhatsApp. Until then, choose email so you do not miss anything.</p>}
          {state === 'error' && <p role="alert" className="text-sm text-rum-danger">{message}</p>}
          <button type="submit" disabled={state === 'sending'} className="min-h-12 w-full rounded-rum-control bg-rum-accent px-4 text-base font-semibold text-rum-on-accent disabled:opacity-70">
            {state === 'sending' ? 'Saving…' : 'Keep me posted'}
          </button>
          <p className="text-xs text-rum-muted">Used only for these alerts. Unsubscribe any time.</p>
        </form>
      )}
    </div>
  );
}
