'use client';

import { useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, Banknote, GraduationCap } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { BookTourForm } from '@/components/legacy/book-tour-form';
import { useTourZones } from '@/hooks/use-tour-zones';
import type { TourZoneOption } from '@/hooks/use-tour-zones';
import { cn } from '@/lib/utils/cn';

export default function AccountBookTourPage() {
  const { sections, loading } = useTourZones();
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
        campusId={selectedZone.campusId}
        campusName={selectedZone.campusName}
        agentId=""
      />
    );
  }

  const zoneCount = sections.reduce((sum, s) => sum + s.zones.length, 0);

  return (
    <div className="min-h-screen bg-slate-50/50 py-10">
      <div className="mx-auto max-w-lg px-4">
        <div className="mb-8">
          <Link
            href="/account"
            className="inline-flex items-center gap-1.5 text-sm font-semibold text-slate-500 hover:text-slate-900 transition-colors mb-4"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to my account
          </Link>
          <h1 className="text-2xl font-black text-slate-900 tracking-tight">
            Book a Hostel Tour
          </h1>
          <p className="text-slate-500 font-medium mt-1 text-sm">
            Pick your university, then the area you want to tour and a verified
            agent will walk you through the options.
          </p>
        </div>

        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6 space-y-5">
          <div>
            <p className="text-sm font-bold text-slate-700 mb-3">
              Select your campus and area
            </p>
            {loading ? (
              <div className="grid grid-cols-2 gap-3" aria-busy="true">
                {[0, 1, 2, 3].map((i) => (
                  <div key={i} className="skeleton h-20 rounded-xl" />
                ))}
              </div>
            ) : zoneCount === 0 ? (
              <div className="rounded-xl border-2 border-dashed border-slate-200 p-6 text-center">
                <p className="text-sm font-semibold text-slate-700">
                  No tour zones set up yet
                </p>
                <p className="text-xs text-slate-500 mt-1">
                  Tour pricing is configured by campus managers. Check back
                  soon.
                </p>
              </div>
            ) : (
              <div className="space-y-6">
                {sections.map((section) => (
                  <div key={section.campusId}>
                    <div className="flex items-center gap-2 mb-2">
                      <GraduationCap className="h-4 w-4 text-slate-400" />
                      <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                        {section.campusName}
                      </h3>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      {section.zones.map((zone) => {
                        const isSelected =
                          selectedZone?.campusId === zone.campusId &&
                          selectedZone?.value === zone.value;
                        return (
                          <button
                            key={`${zone.campusId}-${zone.value}`}
                            type="button"
                            onClick={() => setSelectedZone(zone)}
                            className={cn(
                              'relative flex flex-col items-start rounded-xl border-2 p-3.5 text-left transition-all duration-200',
                              isSelected
                                ? 'border-emerald-600 bg-emerald-50 shadow-sm shadow-emerald-600/10'
                                : 'border-slate-200 hover:border-slate-300 bg-white',
                            )}
                          >
                            <span
                              className={cn(
                                'text-sm font-bold',
                                isSelected
                                  ? 'text-emerald-800'
                                  : 'text-slate-900',
                              )}
                            >
                              {zone.label}
                            </span>
                            <span
                              className={cn(
                                'mt-1.5 inline-flex items-center gap-1 text-xs font-bold',
                                isSelected
                                  ? 'text-emerald-700'
                                  : 'text-slate-500',
                              )}
                            >
                              <Banknote className="h-3 w-3" />
                              KSh {zone.price.toLocaleString()}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                ))}
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