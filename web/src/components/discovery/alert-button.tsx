'use client';

import { useState } from 'react';
import { Bell, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { rumia } from '@/lib/api/rumia';
import { track } from '@/lib/events';
import { isValidKenyanPhone } from '@/lib/utils/phone';

interface AlertButtonProps {
  /** What the person searched for, in the shape the API understands (q, max_price, kind, …). */
  intent: Record<string, unknown>;
  /** A readable name for the alert ("Bedsitter under KSh 8,000"). */
  label: string;
  className?: string;
  onCreated?: () => void;
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** "Tell me when something new fits": a saved search that emails (or later WhatsApps) new matches. No account needed. */
export function AlertButton({ intent, label, className = '', onCreated }: AlertButtonProps) {
  const [open, setOpen] = useState(false);
  const [channel, setChannel] = useState<'email' | 'whatsapp'>('email');
  const [contact, setContact] = useState('');
  const [frequency, setFrequency] = useState<'instant' | 'daily' | 'weekly'>('daily');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const value = contact.trim();
    if (channel === 'email' ? !EMAIL_RE.test(value) : !isValidKenyanPhone(value)) {
      setError(channel === 'email' ? 'Enter a valid email address.' : 'Enter a valid Kenyan number, like 0712 345 678.');
      return;
    }
    setError('');
    setBusy(true);
    const res = await rumia
      .POST('/api/v1/discovery/alerts', {
        body: { intent, label, channel, frequency, email: channel === 'email' ? value : undefined, phone: channel === 'whatsapp' ? value : undefined },
      })
      .catch(() => null);
    setBusy(false);
    if (!res || res.error) {
      toast.error('Could not set up the alert. Please try again.');
      return;
    }
    track('alert_created', { props: { channel, frequency } });
    toast.success('Done. We will tell you when a new place fits.');
    setOpen(false);
    onCreated?.();
  }

  return (
    <>
      <Button type="button" variant="outline" onClick={() => setOpen(true)} className={`min-h-11 gap-2 rounded-xl ${className}`}>
        <Bell className="h-4 w-4" aria-hidden="true" />
        Notify me
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Tell me when something new fits</DialogTitle>
            <DialogDescription>{label}</DialogDescription>
          </DialogHeader>
          <form onSubmit={submit} noValidate className="space-y-4">
            <div className="flex gap-2" role="radiogroup" aria-label="How should we tell you?">
              {(['email', 'whatsapp'] as const).map((c) => (
                <button
                  key={c}
                  type="button"
                  role="radio"
                  aria-checked={channel === c}
                  onClick={() => {
                    setChannel(c);
                    setContact('');
                    setError('');
                  }}
                  className={`min-h-11 flex-1 rounded-xl border px-3 text-sm font-semibold ${
                    channel === c ? 'border-slate-900 bg-slate-900 text-white' : 'border-slate-300 text-slate-700'
                  }`}
                >
                  {c === 'email' ? 'Email' : 'WhatsApp'}
                </button>
              ))}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="alert-contact">{channel === 'email' ? 'Your email' : 'Your WhatsApp number'}</Label>
              <Input
                id="alert-contact"
                type={channel === 'email' ? 'email' : 'tel'}
                inputMode={channel === 'email' ? 'email' : 'tel'}
                autoComplete={channel === 'email' ? 'email' : 'tel'}
                placeholder={channel === 'email' ? 'you@example.com' : '0712 345 678'}
                value={contact}
                onChange={(e) => setContact(e.target.value)}
                aria-invalid={error ? true : undefined}
                aria-describedby={error ? 'alert-error' : undefined}
                className="h-11"
              />
              {error && (
                <p id="alert-error" className="text-xs font-medium text-rose-600">
                  {error}
                </p>
              )}
              {channel === 'whatsapp' && <p className="text-xs text-slate-500">WhatsApp alerts start once messaging is connected. Email works now.</p>}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="alert-frequency">How often</Label>
              <select
                id="alert-frequency"
                value={frequency}
                onChange={(e) => setFrequency(e.target.value as typeof frequency)}
                className="h-11 w-full rounded-md border border-slate-300 bg-white px-3 text-sm"
              >
                <option value="instant">As soon as one appears</option>
                <option value="daily">Once a day</option>
                <option value="weekly">Once a week</option>
              </select>
            </div>
            <Button type="submit" disabled={busy} className="h-12 w-full rounded-xl bg-slate-900 font-bold text-white hover:bg-slate-800">
              {busy ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : 'Notify me'}
            </Button>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
