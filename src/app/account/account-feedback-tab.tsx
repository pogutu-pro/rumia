'use client';

import { FeedbackForm } from '@/components/feedback/feedback-form';

export function AccountFeedbackTab() {
  return (
    <div className="bg-white border border-slate-100 rounded-2xl p-5">
      <div className="mb-4">
        <h3 className="text-sm font-bold text-slate-900">
          Share your feedback
        </h3>
        <p className="text-xs text-slate-400 mt-0.5">
          All fields optional. Tell us what you think.
        </p>
      </div>
      <FeedbackForm />
    </div>
  );
}
