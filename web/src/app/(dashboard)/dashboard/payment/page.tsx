'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { ArrowLeft, Wallet } from 'lucide-react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { updateAgentProfileAction } from '@/app/actions/agents';

export default function PaymentSettingsPage() {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const [pochiLaBiasharaNumber, setPochiLaBiasharaNumber] = useState('');
  const [expectedName, setExpectedName] = useState('');

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();

    startTransition(async () => {
      const result = await updateAgentProfileAction({
        pochi_la_biashara_number: pochiLaBiasharaNumber || null,
        expected_name: expectedName || null,
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
    <div className="max-w-2xl mx-auto space-y-6">
      <div>
        <Link
          href="/dashboard"
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-600 hover:text-slate-900 transition-colors mb-3"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Dashboard
        </Link>
        <h1 className="text-lg sm:text-2xl font-bold text-slate-900 tracking-tight">
          Payment Settings
        </h1>
        <p className="text-xs sm:text-sm text-slate-500 mt-1">
          Set up your Pochi la Biashara details so students can pay your consultation fee directly.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6 bg-white rounded-2xl border border-slate-200/80 p-6 shadow-sm">
        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="pochi-number">Pochi la Biashara Number (optional)</Label>
            <Input
              id="pochi-number"
              type="text"
              value={pochiLaBiasharaNumber}
              onChange={(e) => setPochiLaBiasharaNumber(e.target.value)}
              placeholder="e.g. 0712 345 678 or till number"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="pochi-name">Pochi Registered Name (optional)</Label>
            <Input
              id="pochi-name"
              type="text"
              value={expectedName}
              onChange={(e) => setExpectedName(e.target.value)}
              placeholder="Name registered to Pochi number"
            />
          </div>
          <p className="text-xs text-slate-400">
            When set, these details replace your WhatsApp number and name in
            consultation messages. Both fields are optional — if not set, your
            base WhatsApp number and display name will be used instead.
          </p>
        </div>

        <Button type="submit" disabled={isPending} size="lg" className="w-full">
          {isPending ? 'Saving...' : 'Save Payment Details'}
        </Button>
      </form>
    </div>
  );
}