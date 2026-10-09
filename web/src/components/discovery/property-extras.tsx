'use client';

import { useEffect, useState } from 'react';
import { CheckCircle2, Clock, Flag, Loader2, ShieldCheck } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { rumia, type SearchCard } from '@/lib/api/rumia';
import { DiscoveryCard } from './search-card';

type Fact = { kind: string; text: string };

const FACT_ICON: Record<string, typeof Clock> = { availability: Clock, visit: ShieldCheck, registry: CheckCircle2 };

/** Dated, plain statements about a place ("Available, confirmed by the owner 3 days ago"). Only what has evidence is shown. */
export function PropertyFacts({ slug }: { slug: string }) {
  const [facts, setFacts] = useState<Fact[]>([]);

  useEffect(() => {
    let active = true;
    (async () => {
      const res = await rumia.GET('/api/v1/properties/{slug}', { params: { path: { slug } } }).catch(() => null);
      if (active && res?.data) setFacts(res.data.facts);
    })();
    return () => {
      active = false;
    };
  }, [slug]);

  if (facts.length === 0) return null;
  return (
    <ul className="space-y-2 rounded-2xl border border-slate-200/60 bg-slate-50/60 p-4" aria-label="What we know about this place">
      {facts.map((f) => {
        const Icon = FACT_ICON[f.kind] ?? CheckCircle2;
        return (
          <li key={f.text} className="flex items-start gap-2.5 text-sm text-slate-700">
            <Icon className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" aria-hidden="true" />
            <span>{f.text}</span>
          </li>
        );
      })}
    </ul>
  );
}

/** Places of the same kind at a similar price, same area first. */
export function SimilarPlaces({ slug }: { slug: string }) {
  const [cards, setCards] = useState<SearchCard[]>([]);

  useEffect(() => {
    let active = true;
    (async () => {
      const res = await rumia.GET('/api/v1/discovery/properties/{slug}/similar', { params: { path: { slug } } }).catch(() => null);
      if (active && res?.data) setCards(res.data.items.slice(0, 4));
    })();
    return () => {
      active = false;
    };
  }, [slug]);

  if (cards.length === 0) return null;
  return (
    <section aria-labelledby="similar-heading">
      <h2 id="similar-heading" className="mb-3 text-lg font-bold text-slate-900">
        Similar places
      </h2>
      <div className="grid grid-cols-2 gap-x-4 gap-y-6 lg:grid-cols-4">
        {cards.map((c) => (
          <DiscoveryCard key={c.id} card={c} />
        ))}
      </div>
    </section>
  );
}

const REASONS = [
  { value: 'not_available', label: 'It is no longer available' },
  { value: 'wrong_price', label: 'The price is wrong' },
  { value: 'wrong_location', label: 'The location is wrong' },
  { value: 'scam', label: 'It looks like a scam' },
  { value: 'other', label: 'Something else' },
] as const;

/** Lets anyone flag a problem; repeated reports make Rumia re-check the place. */
export function ReportListing({ slug }: { slug: string }) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState<(typeof REASONS)[number]['value']>('not_available');
  const [details, setDetails] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    const res = await rumia
      .POST('/api/v1/properties/{slug}/reports', { params: { path: { slug } }, body: { reason, details: details.trim() || undefined } })
      .catch(() => null);
    setBusy(false);
    if (!res || res.error) {
      toast.error('Could not send your report. Please try again.');
      return;
    }
    toast.success('Thank you. We will look into it.');
    setOpen(false);
    setDetails('');
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex min-h-11 items-center gap-1.5 text-sm font-medium text-slate-500 underline-offset-2 hover:text-slate-800 hover:underline"
      >
        <Flag className="h-4 w-4" aria-hidden="true" />
        Report a problem with this listing
      </button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Report this listing</DialogTitle>
            <DialogDescription>Tell us what is wrong. You do not need an account.</DialogDescription>
          </DialogHeader>
          <form onSubmit={submit} className="space-y-4">
            <fieldset className="space-y-2">
              <legend className="sr-only">What is wrong?</legend>
              {REASONS.map((r) => (
                <label key={r.value} className="flex min-h-11 cursor-pointer items-center gap-3 rounded-xl border border-slate-200 px-3 text-sm text-slate-800 has-[:checked]:border-slate-900">
                  <input type="radio" name="reason" value={r.value} checked={reason === r.value} onChange={() => setReason(r.value)} />
                  {r.label}
                </label>
              ))}
            </fieldset>
            <div className="space-y-1.5">
              <Label htmlFor="report-details">More detail (optional)</Label>
              <textarea
                id="report-details"
                value={details}
                maxLength={500}
                onChange={(e) => setDetails(e.target.value)}
                rows={3}
                className="w-full rounded-md border border-slate-300 p-2.5 text-sm"
              />
            </div>
            <Button type="submit" disabled={busy} className="h-12 w-full rounded-xl bg-slate-900 font-bold text-white hover:bg-slate-800">
              {busy ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : 'Send report'}
            </Button>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
