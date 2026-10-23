'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { Loader2, ShieldCheck } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { updateAgentProfileAction } from '@/app/actions/agents';
import { primaryButton } from '@/app/(dashboard)/dashboard-ui';

interface PaymentFormProps {
  /** Saved values, so opening the page and saving never wipes what the agent already set. */
  initialNumber: string;
  initialName: string;
}

export function PaymentForm({ initialNumber, initialName }: PaymentFormProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [pochiLaBiasharaNumber, setPochiLaBiasharaNumber] = useState(initialNumber);
  const [expectedName, setExpectedName] = useState(initialName);

  const unchanged = pochiLaBiasharaNumber === initialNumber && expectedName === initialName;

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();

    startTransition(async () => {
      const result = await updateAgentProfileAction({
        pochi_la_biashara_number: pochiLaBiasharaNumber.trim() || null,
        expected_name: expectedName.trim() || null,
      });

      if (result.success) {
        toast.success('Payment details saved');
        router.refresh();
      } else {
        toast.error(result.error);
      }
    });
  }

  return (
    <form onSubmit={handleSubmit} className="overflow-hidden rounded-2xl border border-line bg-raised">
      <div className="space-y-5 p-5 sm:p-6">
        <div className="space-y-1.5">
          <Label htmlFor="pochi-number" className="text-sm font-semibold text-ink">
            Pochi la Biashara number
          </Label>
          <Input
            id="pochi-number"
            type="text"
            inputMode="tel"
            value={pochiLaBiasharaNumber}
            onChange={(e) => setPochiLaBiasharaNumber(e.target.value)}
            placeholder="0712 345 678 or till number"
            className="h-12 rounded-xl"
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="pochi-name" className="text-sm font-semibold text-ink">
            Registered name
          </Label>
          <Input
            id="pochi-name"
            type="text"
            autoComplete="name"
            value={expectedName}
            onChange={(e) => setExpectedName(e.target.value)}
            placeholder="Name registered to the Pochi number"
            className="h-12 rounded-xl"
          />
          <p className="text-[13px] text-ink-muted">Students see this name when they pay, so they know it&apos;s you.</p>
        </div>
      </div>

      <div className="flex flex-col gap-3 border-t border-line bg-subtle/50 px-5 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6">
        <p className="flex items-start gap-2 text-[13px] leading-snug text-ink-muted">
          <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-primary" aria-hidden />
          Both are optional. Without them, your WhatsApp number and display name are used in payment messages.
        </p>
        <button type="submit" disabled={isPending || unchanged} className={`${primaryButton} shrink-0 disabled:opacity-40`}>
          {isPending && <Loader2 className="h-4 w-4 animate-spin" aria-hidden />}
          {isPending ? 'Saving' : 'Save details'}
        </button>
      </div>
    </form>
  );
}
