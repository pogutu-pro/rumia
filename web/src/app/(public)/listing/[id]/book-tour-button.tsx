'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { CalendarCheck } from 'lucide-react';
import { BookTourForm } from './book-tour-form';

interface BookTourButtonProps {
  listingId: string | number;
  listingTitle: string;
  listingZone: string | null;
  agentId: string | number;
  zoneTourPrice?: number | null;
  listingCampusId?: string | null;
}

export function BookTourButton({
  listingId,
  listingTitle,
  listingZone,
  agentId,
  zoneTourPrice,
  listingCampusId,
}: BookTourButtonProps) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <>
      <Button
        onClick={() => setIsOpen(true)}
        className="w-full h-12 bg-slate-900 hover:bg-slate-800 hover:scale-[1.01] text-white font-bold rounded-xl transition-all duration-300 shadow-md shadow-slate-900/10 flex items-center justify-center gap-2 border-0"
      >
        <CalendarCheck className="h-5 w-5" />
        Book a Tour
      </Button>

      <BookTourForm
        isOpen={isOpen}
        onClose={() => setIsOpen(false)}
        listingId={listingId}
        listingTitle={listingTitle}
        listingZone={listingZone}
        agentId={agentId}
        zoneFullSearchPrice={zoneTourPrice ?? undefined}
        campusId={listingCampusId ?? undefined}
      />
    </>
  );
}
