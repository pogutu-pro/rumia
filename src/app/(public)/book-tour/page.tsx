'use client';

import { useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, MapPin } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { BookTourForm } from '@/app/(public)/listing/[id]/book-tour-form';
import { AREA_OPTIONS } from '@/lib/constants/dekut-areas';

export default function BookTourPage() {
  const [selectedZone, setSelectedZone] = useState<string | null>(null);
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
        listingZone={selectedZone}
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
            <div className="grid grid-cols-2 gap-3">
              {AREA_OPTIONS.map((zone) => (
                <button
                  key={zone.value}
                  type="button"
                  onClick={() => setSelectedZone(zone.value)}
                  className={`h-auto min-h-[3.5rem] rounded-xl border-2 text-left px-3 py-2.5 transition-all ${
                    selectedZone === zone.value
                      ? 'border-slate-900 bg-slate-50 text-slate-900'
                      : 'border-slate-200 text-slate-600 hover:border-slate-300'
                  }`}
                >
                  <span className="text-sm font-semibold block">{zone.label}</span>
                  {zone.distance && (
                    <span className="text-[11px] text-slate-400 font-medium flex items-center gap-1 mt-0.5">
                      <MapPin className="h-2.5 w-2.5" />
                      {zone.distance}
                    </span>
                  )}
                </button>
              ))}
            </div>
          </div>

          <Button
            disabled={!selectedZone}
            onClick={() => setFormOpen(true)}
            className="w-full h-12 bg-slate-900 hover:bg-slate-800 text-white font-bold rounded-xl"
          >
            Continue
          </Button>

          <p className="text-[10px] text-center text-slate-400 font-medium">
            Pay the agent directly when you arrive. No online payment required.
          </p>
        </div>
      </div>
    </div>
  );
}
