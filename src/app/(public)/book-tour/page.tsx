'use client';

import { useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, Banknote } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { BookTourForm } from '@/app/(public)/listing/[id]/book-tour-form';
import { useTourZones } from '@/hooks/use-tour-zones';
import type { TourZoneOption } from '@/hooks/use-tour-zones';
import { cn } from '@/lib/utils/cn';

export default function BookTourPage() {
  const { zones, loading } = useTourZones();
  const [selectedZone, setSelectedZone] = useState<TourZoneOption | null>(null);
  const [formOpen, setFormOpen] = useState(false);

  if (formOpen && selectedZone) {
    return (
      <BookTourForm
        isOpen={true}
        onClose={() => {
          setFormOpen(false);
          setSelectedZone(null);
        }}
        listingId=""
        listingTitle=""
        listingZone={selectedZone.value}
        zoneFullSearchPrice={selectedZone.price}
        agentId=""
      />
    );
  }

  return (
    <div className="min-h-screen bg-slate-50/50 py-10">
      <div className="mx-auto max-w-lg px-4">
        <div className="mb-8">
          <Link
            href="/hostels"
            className="inline-flex items-center gap-1.5 text-sm font-semibold text-slate-500 hover:text-slate-900 transition-colors mb-4"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to hostels
          </Link>
          <h1 className="text-2xl font-black text-slate-900 tracking-tight">
            Book a Hostel Tour
          </h1>
          <p className="text-slate-500 font-medium mt-1 text-sm">
            Pick the area you want to tour and a verified agent will walk you through the options.
          </p>
        </div>

        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6 space-y-5">
          <div>
            <p className="text-sm font-bold text-slate-700 mb-3">
              Select your area
            </p>
            {loading ? (
              <div className="grid grid-cols-2 gap-3" aria-busy="true">
                {[0, 1, 2, 3].map((i) => (
                  <div key={i} className="skeleton h-20 rounded-xl" />
                ))}
              </div>
            ) : (
            <div className="grid grid-cols-2 gap-3">
              {zones.map((zone) => {
                const isSelected = selectedZone?.value === zone.value;
                return (
                  <button
                    key={zone.value}
                    type="button"
                    onClick={() => setSelectedZone(zone)}
                    className={cn(
                      'relative flex flex-col items-start rounded-xl border-2 p-3.5 text-left transition-all duration-200',
                      isSelected
                        ? 'border-emerald-600 bg-emerald-50 shadow-sm shadow-emerald-600/10'
                        : 'border-slate-200 hover:border-slate-300 bg-white',
                    )}
                  >
                    <span className={cn(
                      'text-sm font-bold',
                      isSelected ? 'text-emerald-800' : 'text-slate-900',
                    )}>
                      {zone.label}
                    </span>
                    <span className={cn(
                      'mt-1.5 inline-flex items-center gap-1 text-xs font-bold',
                      isSelected ? 'text-emerald-700' : 'text-slate-500',
                    )}>
                      <Banknote className="h-3 w-3" />
                      KSh {zone.price.toLocaleString()}
                    </span>
                  </button>
                );
              })}
            </div>
            )}
          </div>

          <Button
            disabled={!selectedZone}
            onClick={() => setFormOpen(true)}
            className="w-full h-12 bg-slate-900 hover:bg-slate-800 text-white font-bold rounded-xl"
          >
            Continue
          </Button>

          <p className="text-xs text-center text-slate-600 font-bold">
            Pay the agent directly when you arrive. No online payment required.
          </p>
        </div>
      </div>
    </div>
  );
}
