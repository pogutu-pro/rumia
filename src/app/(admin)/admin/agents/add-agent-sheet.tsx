'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { createAgentAction } from '@/app/actions/admin';

interface AddAgentSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function AddAgentSheet({ open, onOpenChange }: AddAgentSheetProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [whatsapp, setWhatsapp] = useState('');

  function resetForm() {
    setName('');
    setPhone('');
    setWhatsapp('');
  }

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();

    startTransition(async () => {
      const result = await createAgentAction({ name, phone, whatsapp });

      if (result.success) {
        resetForm();
        onOpenChange(false);
        toast.success('Agent created successfully');
        router.refresh();
      } else {
        toast.error(result.error);
      }
    });
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right">
        <SheetHeader className="mb-6">
          <SheetTitle>Add Agent</SheetTitle>
        </SheetHeader>

        <form onSubmit={handleSubmit} className="flex flex-col gap-5">
          {/* Name */}
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="agent-name">Name</Label>
            <Input
              id="agent-name"
              type="text"
              placeholder="Full name"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              disabled={isPending}
            />
          </div>

          {/* Phone */}
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="agent-phone">Phone</Label>
            <Input
              id="agent-phone"
              type="tel"
              placeholder="+254 7XX XXX XXX"
              required
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              disabled={isPending}
            />
          </div>

          {/* WhatsApp */}
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="agent-whatsapp">WhatsApp</Label>
            <Input
              id="agent-whatsapp"
              type="tel"
              placeholder="+254 7XX XXX XXX"
              required
              value={whatsapp}
              onChange={(e) => setWhatsapp(e.target.value)}
              disabled={isPending}
            />
          </div>

          <Button type="submit" disabled={isPending} className="mt-2">
            {isPending ? 'Creating...' : 'Create Agent'}
          </Button>
        </form>
      </SheetContent>
    </Sheet>
  );
}
