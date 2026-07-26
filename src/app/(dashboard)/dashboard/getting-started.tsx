'use client';

import { CheckCircle2, Circle, ArrowRight } from 'lucide-react';
import { Agent, Listing } from '@/types';
import Link from 'next/link';

interface GettingStartedProps {
  agent: Agent;
  listings: Listing[];
}

export function GettingStarted({ agent, listings }: GettingStartedProps) {
  const hasListing = listings.length > 0;
  const hasFivePhotos = listings.some(
    (l) => (l as any).listing_images?.length >= 5
  );
  const hasPublished = listings.some((l) => l.is_active);

  const isFullyComplete = hasListing && hasFivePhotos && hasPublished;

  if (isFullyComplete) return null;

  const steps = [
    {
      done: hasListing,
      label: hasListing ? 'Create first listing' : 'Create your first listing',
      href: hasListing ? undefined : '/dashboard/new',
    },
    {
      done: hasFivePhotos,
      label: 'Add at least 5 photos to a listing',
    },
    {
      done: hasPublished,
      label: 'Publish a listing',
    },
  ];

  const completedCount = steps.filter((s) => s.done).length;

  return (
    <div className="bg-slate-50 border border-slate-200/80 rounded-2xl p-4 sm:p-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-4 mb-4">
        <div className="space-y-1">
          <h2 className="text-sm font-bold text-slate-900">
            Getting Started
          </h2>
          <p className="text-xs text-slate-500">
            Complete these steps to activate your account and start receiving
            student leads.
          </p>
        </div>
        <span className="text-[10px] sm:text-xs font-bold px-2.5 py-1 rounded-full bg-slate-200 text-slate-700 tabular-nums self-start">
          {completedCount}/{steps.length}
        </span>
      </div>

      <div className="space-y-2">
        {steps.map((step, i) => (
          <div key={i} className="flex items-center gap-3">
            {step.done ? (
              <CheckCircle2 className="h-4 w-4 text-emerald-500 shrink-0" />
            ) : (
              <Circle className="h-4 w-4 text-slate-300 shrink-0" />
            )}
            {step.href ? (
              <Link
                href={step.href}
                className="text-xs sm:text-sm font-medium text-slate-700 hover:text-emerald-600 transition-colors flex items-center gap-1.5"
              >
                {step.label}
                <ArrowRight className="h-3 w-3" />
              </Link>
            ) : (
              <span
                className={`text-xs sm:text-sm font-medium ${
                  step.done
                    ? 'text-slate-400 line-through'
                    : 'text-slate-700'
                }`}
              >
                {step.label}
              </span>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
