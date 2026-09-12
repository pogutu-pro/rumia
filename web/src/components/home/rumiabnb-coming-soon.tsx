'use client';

import { House, MessageCircle, Phone } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { CopyButton } from '@/components/ui/copy-button';
import {
  Modal,
  ModalContent,
  ModalDescription,
  ModalHeader,
  ModalTitle,
} from '@/components/ui/dialog';
import { buildWhatsAppUrl } from '@/lib/utils/phone';

export const RUMIA_BNB_PHONE = '0114845619';

const WHATSAPP_MESSAGE =
  'Hi Rumia, I\u0027m looking for a house for a short stay. Please share available houses, videos, pictures, prices, and details.';

interface RumiaBnbComingSoonProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function RumiaBnbComingSoon({
  open,
  onOpenChange,
}: RumiaBnbComingSoonProps) {
  const whatsappHref = buildWhatsAppUrl(RUMIA_BNB_PHONE, WHATSAPP_MESSAGE);

  return (
    <Modal open={open} onOpenChange={onOpenChange}>
      <ModalContent className="rounded-2xl sm:max-w-md">
        <ModalHeader className="space-y-3">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-emerald-50 ring-1 ring-emerald-100">
            <House className="h-6 w-6 text-emerald-600" strokeWidth={2} />
          </div>
          <span className="mx-auto rounded-full bg-emerald-100 px-2.5 py-1 text-[11px] font-bold uppercase tracking-wider text-emerald-700">
            Coming soon
          </span>
          <ModalTitle className="text-center text-xl font-black tracking-tight text-slate-900">
            Rumiabnb is coming soon 🏡
          </ModalTitle>
          <ModalDescription className="mx-auto max-w-sm text-center text-sm font-medium leading-6 text-slate-600">
            Looking for a house for a short stay? We can still help you find
            one.
          </ModalDescription>
        </ModalHeader>

        <div className="flex flex-col gap-4 px-6 pt-1">
          <p className="text-center text-sm font-medium leading-6 text-slate-600">
            Contact{' '}
            <span className="font-bold text-slate-900">{RUMIA_BNB_PHONE}</span>{' '}
            to get available houses, videos, pictures, prices, and details.
          </p>

          <a
            href={`tel:${RUMIA_BNB_PHONE}`}
            className="flex items-center justify-center gap-2.5 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3.5 transition-colors hover:bg-emerald-100"
          >
            <Phone className="h-5 w-5 text-emerald-600" strokeWidth={2} />
            <span className="text-lg font-black tracking-tight text-slate-900">
              {RUMIA_BNB_PHONE}
            </span>
            <span className="rounded-full bg-white px-2 py-0.5 text-[11px] font-bold text-emerald-700 shadow-sm">
              Call
            </span>
          </a>

          <div className="text-center">
            <CopyButton
              textToCopy={RUMIA_BNB_PHONE}
              label="Copy number"
              className="w-full sm:w-auto"
            />
          </div>

          <p className="border-t border-slate-100 pt-4 text-center text-xs font-semibold text-slate-400">
            Rumiabnb <span className="mx-1 text-slate-300">|</span> Short stays
            made simple <span className="mx-1 text-slate-300">|</span> Coming
            soon
          </p>
        </div>

        <div className="mt-3 grid grid-cols-2 items-center gap-3 px-6 pb-6 pt-2">
          <Button
            variant="outline"
            className="w-full"
            onClick={() => onOpenChange(false)}
          >
            Cancel
          </Button>
          <Button variant="default" className="w-full" asChild>
            <a href={whatsappHref} target="_blank" rel="noopener noreferrer">
              <MessageCircle className="h-4 w-4" />
              <span>Reserve</span>
            </a>
          </Button>
        </div>
      </ModalContent>
    </Modal>
  );
}