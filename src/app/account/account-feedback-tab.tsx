'use client';

import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { FeedbackForm } from '@/components/feedback/feedback-form';

interface AccountFeedbackTabProps {
  onBackToOverview?: () => void;
}

export function AccountFeedbackTab({ onBackToOverview }: AccountFeedbackTabProps) {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        {onBackToOverview ? (
          <button
            onClick={onBackToOverview}
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-600 hover:text-slate-900 transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to Overview
          </button>
        ) : (
          <Link
            href="/account?tab=overview"
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-600 hover:text-slate-900 transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to Overview
          </Link>
        )}
      </div>

      <div className="bg-white border border-slate-200/80 rounded-2xl p-5 sm:p-6 space-y-4">
        <div>
          <h3 className="text-base font-bold text-slate-900">
            Share your feedback
          </h3>
          <p className="text-xs text-slate-500 mt-0.5">
            Tell us how we can make Rumia better for DeKUT students. All fields optional.
          </p>
        </div>
        <FeedbackForm />
      </div>
    </div>
  );
}
