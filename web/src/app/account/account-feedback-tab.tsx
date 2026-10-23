'use client';

import { AccountPageHeader } from './account-ui';
import { FeedbackForm } from '@/components/feedback/feedback-form';

interface AccountFeedbackTabProps {
  onBackToOverview?: () => void;
}

export function AccountFeedbackTab({ onBackToOverview }: AccountFeedbackTabProps) {
  return (
    <div className="mx-auto max-w-2xl space-y-8">
      <AccountPageHeader
        title="Share feedback"
        description="Tell us how we can make Rumia better. Every field is optional."
        onBack={onBackToOverview}
      />

      <div className="rounded-2xl border border-line bg-raised p-5 sm:p-6">
        <FeedbackForm />
      </div>
    </div>
  );
}
