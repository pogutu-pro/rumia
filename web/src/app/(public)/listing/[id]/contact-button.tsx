'use client';

import { useState } from 'react';
import { MessageCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ContactModal, consumePendingContact } from './contact-modal';

interface ContactButtonProps {
  listingId: string;
  listingTitle: string;
  agentId: string;
  agentPhone: string;
  landlordPhone?: string | null;
  paysCommission: boolean;
  consultationFee?: number | null;
  isFull?: boolean;
  className?: string;
  fullWidth?: boolean;
}

export function ContactButton({
  listingId,
  listingTitle,
  agentId,
  agentPhone,
  landlordPhone,
  paysCommission,
  consultationFee,
  isFull,
  className,
  fullWidth = true,
}: ContactButtonProps) {
  // Resume flow if returning from OAuth redirect — read once at mount. This is
  // SSR-safe: consumePendingContact swallows sessionStorage errors, so the
  // server and initial hydration render with no pending contact.
  const pending = useState(() => consumePendingContact())[0];
  const resumesFlow = pending?.hostelId === listingId;
  const [isOpen, setIsOpen] = useState(resumesFlow);
  const [resumedType, setResumedType] = useState<
    'hostel_owner' | 'rumia_agent' | null
  >(resumesFlow ? (pending?.contactType ?? null) : null);

  return (
    <>
      <Button
        onClick={() => setIsOpen(true)}
        className={`h-12 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-xl transition-all duration-300 shadow-xs active:scale-[0.98] ${
          fullWidth ? 'w-full' : ''
        } ${className || ''}`}
      >
        <MessageCircle className="h-5 w-5 mr-2" />
        Contact
      </Button>

      <ContactModal
        isOpen={isOpen}
        onClose={() => {
          setIsOpen(false);
          setResumedType(null);
        }}
        listingId={listingId}
        listingTitle={listingTitle}
        agentId={agentId}
        agentPhone={agentPhone}
        landlordPhone={landlordPhone}
        paysCommission={paysCommission}
        consultationFee={consultationFee}
        isFull={isFull}
        resumedContactType={resumedType}
      />
    </>
  );
}