'use client';

import { CheckCircle2, Circle } from 'lucide-react';
import { Agent, Listing } from '@/types';
import Link from 'next/link';

interface GettingStartedProps {
  agent: Agent;
  listings: Listing[];
}

export function GettingStarted({ agent, listings }: GettingStartedProps) {
  const hasProfilePhoto = false; // We don't have avatar yet, default to false or assume true if we add it. Let's just say true for now if name exists? Actually, the plan says "Add profile photo". We will simulate it or skip it if there's no DB field. Let's check `hasProfilePhoto` based on a future `avatar_url` or just leave unchecked. For now we will consider it unchecked unless we add it. Let's just make it simple: Check if they have a non-default name. Wait, let's just make it visually represent the requirements.
  const hasListing = listings.length > 0;
  const hasFivePhotos = listings.some((l) => (l as any).listing_images?.length >= 5);
  const hasPublished = listings.some((l) => l.is_active);

  // We can simulate profile photo being done if they have one, or just skip it.
  // Assuming they don't have a photo yet for MVP.
  const isProfileDone = false; 

  const isFullyComplete = isProfileDone && hasListing && hasFivePhotos && hasPublished;

  if (isFullyComplete) return null;

  return (
    <div className="bg-gradient-to-br from-indigo-900 to-slate-900 rounded-3xl p-8 mb-8 text-white shadow-xl relative overflow-hidden border border-white/10">
      <div className="absolute top-0 right-0 w-64 h-64 bg-indigo-500/20 rounded-full blur-3xl -mr-20 -mt-20"></div>
      <div className="relative z-10">
        <h2 className="text-2xl font-black mb-2 tracking-tight">Getting Started</h2>
        <p className="text-indigo-200 font-medium text-sm mb-6 max-w-lg">
          Complete these steps to activate your account and start receiving student leads.
        </p>

        <div className="space-y-3">
          <div className="flex items-center gap-3">
            {isProfileDone ? <CheckCircle2 className="h-5 w-5 text-emerald-400" /> : <Circle className="h-5 w-5 text-indigo-400/50" />}
            <span className={isProfileDone ? "text-indigo-200 line-through" : "text-white font-semibold"}>Add profile photo</span>
          </div>
          
          <div className="flex items-center gap-3">
            {hasListing ? <CheckCircle2 className="h-5 w-5 text-emerald-400" /> : <Circle className="h-5 w-5 text-indigo-400/50" />}
            <span className={hasListing ? "text-indigo-200 line-through" : "text-white font-semibold"}>
              {hasListing ? "Create first listing" : <Link href="/dashboard/new" className="hover:text-indigo-200 transition-colors">Create first listing</Link>}
            </span>
          </div>

          <div className="flex items-center gap-3">
            {hasFivePhotos ? <CheckCircle2 className="h-5 w-5 text-emerald-400" /> : <Circle className="h-5 w-5 text-indigo-400/50" />}
            <span className={hasFivePhotos ? "text-indigo-200 line-through" : "text-white font-semibold"}>Add at least 5 photos</span>
          </div>

          <div className="flex items-center gap-3">
            {hasPublished ? <CheckCircle2 className="h-5 w-5 text-emerald-400" /> : <Circle className="h-5 w-5 text-indigo-400/50" />}
            <span className={hasPublished ? "text-indigo-200 line-through" : "text-white font-semibold"}>Publish listing</span>
          </div>
        </div>
      </div>
    </div>
  );
}
