'use client';

import { useState, useTransition } from 'react';
import { toast } from 'sonner';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { createCommissionAction } from '@/app/actions/admin';

interface CreateCommissionModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  lead: {
    agentId: string;
    agentName: string;
    listingId: string;
    listingTitle: string;
  } | null;
}

export function CreateCommissionModal({
  open,
  onOpenChange,
  lead,
}: CreateCommissionModalProps) {
  const [amount, setAmount] = useState('');
  const [isPending, startTransition] = useTransition();

  function handleClose(nextOpen: boolean) {
    if (!nextOpen) {
      setAmount('');
    }
    onOpenChange(nextOpen);
  }

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!lead) return;

    const parsedAmount = Number(amount);
    if (isNaN(parsedAmount) || parsedAmount <= 0) return;

    startTransition(async () => {
      const result = await createCommissionAction({
        agent_id: lead.agentId,
        listing_id: lead.listingId,
        amount: parsedAmount,
      });

      if (result.success) {
        setAmount('');
        onOpenChange(false);
        toast.success('Commission created');
      } else {
        toast.error(result.error);
      }
    });
  }

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Create Commission</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit}>
          <div className="px-6 pb-2 space-y-4">
            {/* Agent — read-only */}
            <div className="space-y-1.5">
              <Label>Agent</Label>
              <p className="text-sm text-gray-700 py-2">{lead?.agentName ?? '—'}</p>
            </div>

            {/* Listing — read-only */}
            <div className="space-y-1.5">
              <Label>Listing</Label>
              <p className="text-sm text-gray-700 py-2">{lead?.listingTitle ?? '—'}</p>
            </div>

            {/* Amount */}
            <div className="space-y-1.5">
              <Label htmlFor="commission-amount">Amount (KES)</Label>
              <Input
                id="commission-amount"
                type="number"
                min="0"
                step="1"
                required
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="e.g. 5000"
                disabled={isPending}
              />
            </div>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="ghost"
              onClick={() => handleClose(false)}
              disabled={isPending}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={isPending || !amount}>
              {isPending ? 'Creating...' : 'Create Commission'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
