'use client';

import { useState, useEffect } from 'react';
import { MessageCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ContactModal, consumePendingContact, type PendingContact } from './contact-modal';

interface ContactButtonProps {
  listingId: string;
  listingTitle: string;
  agentId: string;
  agentPhone: string;
  landlordPhone?: string | null;
  paysCommission: boolean;
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
  className,
  fullWidth = true,
}: ContactButtonProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [resumedType, setResumedType] = useState<'hostel_owner' | 'rumia_agent' | null>(null);

  // Resume flow if returning from OAuth redirect
  useEffect(() => {
    const pending = consumePendingContact();
    if (pending && pending.hostelId === listingId) {
      setResumedType(pending.contactType);
      setIsOpen(true);
    }
  }, [listingId]);

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
        resumedContactType={resumedType}
      />
    </>
  );
}
