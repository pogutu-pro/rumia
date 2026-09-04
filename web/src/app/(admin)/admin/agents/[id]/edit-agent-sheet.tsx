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
import { updateAgentAction } from '@/app/actions/admin';

interface EditAgentSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  agent: {
    id: string;
    name: string;
    phone: string;
    whatsapp: string;
  };
}

export function EditAgentSheet({ open, onOpenChange, agent }: EditAgentSheetProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const [name, setName] = useState(agent.name);
  const [phone, setPhone] = useState(agent.phone);
  const [whatsapp, setWhatsapp] = useState(agent.whatsapp);

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();

    startTransition(async () => {
      const result = await updateAgentAction(agent.id, { name, phone, whatsapp });

      if (result.success) {
        onOpenChange(false);
        toast.success('Agent updated successfully');
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
          <SheetTitle>Edit Agent</SheetTitle>
        </SheetHeader>

        <form onSubmit={handleSubmit} className="flex flex-col gap-5">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="edit-agent-name">Name</Label>
            <Input
              id="edit-agent-name"
              type="text"
              placeholder="Full name"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              disabled={isPending}
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="edit-agent-phone">Phone</Label>
            <Input
              id="edit-agent-phone"
              type="tel"
              placeholder="+254 7XX XXX XXX"
              required
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              disabled={isPending}
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="edit-agent-whatsapp">WhatsApp</Label>
            <Input
              id="edit-agent-whatsapp"
              type="tel"
              placeholder="+254 7XX XXX XXX"
              required
              value={whatsapp}
              onChange={(e) => setWhatsapp(e.target.value)}
              disabled={isPending}
            />
          </div>

          <Button type="submit" disabled={isPending} className="mt-2">
            {isPending ? 'Saving...' : 'Save Changes'}
          </Button>
        </form>
      </SheetContent>
    </Sheet>
  );
}
