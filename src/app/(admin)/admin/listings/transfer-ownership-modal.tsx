'use client';

import { useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { Search, AlertTriangle, Check, ArrowRight, Loader2 } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { transferListingAction } from '@/app/actions/admin';

interface TransferOwnershipModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  listing: {
    id: string;
    title: string;
    agent_name: string;
    agent_id: string;
  } | null;
  agents: Array<{ id: string; name: string; status: string }>;
}

export function TransferOwnershipModal({
  open,
  onOpenChange,
  listing,
  agents,
}: TransferOwnershipModalProps) {
  const router = useRouter();
  const [search, setSearch] = useState('');
  const [selectedAgentId, setSelectedAgentId] = useState<string | null>(null);
  const [step, setStep] = useState<'select' | 'confirm'>('select');
  const [isPending, setIsPending] = useState(false);

  const activeAgents = useMemo(
    () => agents.filter((a) => a.status === 'active'),
    [agents]
  );

  const filteredAgents = useMemo(
    () =>
      activeAgents.filter(
        (a) =>
          a.id !== listing?.agent_id &&
          a.name.toLowerCase().includes(search.toLowerCase())
      ),
    [activeAgents, search, listing?.agent_id]
  );

  const selectedAgent = useMemo(
    () => agents.find((a) => a.id === selectedAgentId),
    [agents, selectedAgentId]
  );

  function handleClose(nextOpen: boolean) {
    if (!nextOpen) {
      setSearch('');
      setSelectedAgentId(null);
      setStep('select');
    }
    onOpenChange(nextOpen);
  }

  function handleSelectAgent(agentId: string) {
    setSelectedAgentId(agentId);
    setStep('confirm');
  }

  async function handleConfirm() {
    if (!listing || !selectedAgentId) return;

    setIsPending(true);
    const result = await transferListingAction(listing.id, selectedAgentId);
    setIsPending(false);

    if (result.success) {
      setSearch('');
      setSelectedAgentId(null);
      setStep('select');
      onOpenChange(false);
      toast.success('Ownership transferred successfully');
      router.refresh();
    } else {
      toast.error(result.error);
    }
  }

  function handleBack() {
    setStep('select');
    setSelectedAgentId(null);
  }

  const currentOwnerName = listing?.agent_name ?? '—';
  const listingTitle = listing?.title ?? '—';

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>
            {step === 'select' ? 'Transfer Ownership' : 'Confirm Transfer'}
          </DialogTitle>
          <DialogDescription>
            {step === 'select'
              ? 'Select a new agent to take ownership of this hostel.'
              : 'Review the transfer details before confirming.'}
          </DialogDescription>
        </DialogHeader>

        {step === 'select' ? (
          <div className="px-6 pb-2 space-y-4">
            {/* Current owner info */}
            <div className="bg-slate-50 rounded-lg p-3 text-sm">
              <span className="text-slate-500">Current owner:</span>{' '}
              <span className="font-medium text-slate-900">{currentOwnerName}</span>
            </div>

            {/* Search */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
              <Input
                placeholder="Search agents..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-10"
                autoFocus
              />
            </div>

            {/* Agent list */}
            <div className="max-h-60 overflow-y-auto border border-slate-200 rounded-lg divide-y">
              {filteredAgents.length === 0 ? (
                <p className="text-sm text-slate-400 text-center py-6">
                  {search
                    ? 'No agents match your search.'
                    : 'No other active agents available.'}
                </p>
              ) : (
                filteredAgents.map((agent) => (
                  <button
                    key={agent.id}
                    type="button"
                    onClick={() => handleSelectAgent(agent.id)}
                    className="w-full text-left px-4 py-3 text-sm hover:bg-slate-50 transition-colors flex items-center justify-between group"
                  >
                    <span className="font-medium text-slate-900">{agent.name}</span>
                    <ArrowRight className="h-4 w-4 text-slate-300 group-hover:text-emerald-500 transition-colors" />
                  </button>
                ))
              )}
            </div>
          </div>
        ) : (
          <div className="px-6 pb-2 space-y-4">
            {/* Transfer summary */}
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 space-y-3">
              <div className="flex items-start gap-2">
                <AlertTriangle className="h-5 w-5 text-amber-500 shrink-0 mt-0.5" />
                <div className="text-sm text-amber-800">
                  This will transfer <strong>&ldquo;{listingTitle}&rdquo;</strong> from{' '}
                  <strong>{currentOwnerName}</strong> to{' '}
                  <strong>{selectedAgent?.name ?? '—'}</strong>.
                </div>
              </div>
              <ul className="text-sm text-amber-700 space-y-1 ml-7 list-disc">
                <li>All hostel data (photos, pricing, rooms, reviews) is preserved.</li>
                <li>The new agent will gain full management access.</li>
                <li>The previous owner will lose editing privileges.</li>
                <li>This action cannot be undone automatically.</li>
              </ul>
            </div>
          </div>
        )}

        <DialogFooter>
          {step === 'confirm' && (
            <Button type="button" variant="ghost" onClick={handleBack} disabled={isPending}>
              Back
            </Button>
          )}
          <Button
            type="button"
            variant="ghost"
            onClick={() => handleClose(false)}
            disabled={isPending}
          >
            Cancel
          </Button>
          {step === 'confirm' && (
            <Button
              type="button"
              onClick={handleConfirm}
              disabled={isPending}
              className="bg-emerald-600 hover:bg-emerald-700"
            >
              {isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Transferring...
                </>
              ) : (
                <>
                  <Check className="mr-2 h-4 w-4" />
                  Confirm Transfer
                </>
              )}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
