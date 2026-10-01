'use client';

import { useState, useRef, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { submitFeedbackAction } from '@/app/actions/feedback';
import type { FeedbackCategory } from '@/lib/api/feedback';
import { toast } from 'sonner';
import { Loader2, SendHorizonal } from 'lucide-react';

const CATEGORIES = [
  { value: 'suggest_hostel', label: 'Suggest a hostel to add' },
  { value: 'feature_request', label: 'Feature request' },
  { value: 'report_problem', label: 'Report a problem' },
  { value: 'general', label: 'General feedback' },
] as const;

const PLACEHOLDERS: Record<string, string> = {
  suggest_hostel:
    'Which hostel should we add? Name, location, anything you know...',
  feature_request: 'What would make Rumia more useful for you?',
  report_problem: 'Tell us what went wrong ,broken link, wrong info, anything.',
  general: 'Go for it , praise, ideas, whatever comes to mind.',
};

export function FeedbackForm() {
  const [category, setCategory] = useState<FeedbackCategory>('general');
  const [message, setMessage] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    textareaRef.current?.focus();
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!message.trim() || submitting) return;

    setSubmitting(true);
    const result = await submitFeedbackAction(category, message.trim());

    if (result.success) {
      setSubmitted(true);
      toast.success('Thanks, we read every message');
    } else {
      toast.error(result.error);
    }
    setSubmitting(false);
  }

  if (submitted) {
    return (
      <div className="text-center py-10 space-y-3">
        <div className="w-14 h-14 rounded-full bg-emerald-100 mx-auto flex items-center justify-center">
          <SendHorizonal className="h-6 w-6 text-emerald-600" />
        </div>
        <p className="text-base font-semibold text-slate-800">
          Thanks, we read every message
        </p>
        <p className="text-sm text-slate-500">
          Your feedback helps us improve for everyone.
        </p>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => {
            setSubmitted(false);
            setMessage('');
            setCategory('general');
          }}
          className="mt-2 text-emerald-600 hover:text-emerald-700"
        >
          Send another
        </Button>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <Select value={category} onValueChange={(v) => setCategory(v as FeedbackCategory)}>
        <SelectTrigger className="w-full">
          <SelectValue placeholder="Choose a category" />
        </SelectTrigger>
        <SelectContent>
          {CATEGORIES.map((c) => (
            <SelectItem key={c.value} value={c.value}>
              {c.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Textarea
        ref={textareaRef}
        placeholder={PLACEHOLDERS[category]}
        value={message}
        onChange={(e) => setMessage(e.target.value)}
        rows={4}
        className="resize-none min-h-[100px]"
      />

      <div className="flex items-center justify-between gap-3">
        <span className="text-xs text-slate-400">
          {message.length > 0 &&
            `${message.length} character${message.length === 1 ? '' : 's'}`}
        </span>
        <Button
          type="submit"
          disabled={!message.trim() || submitting}
          size="lg"
        >
          {submitting ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Sending...
            </>
          ) : (
            <>
              <SendHorizonal className="mr-2 h-4 w-4" />
              Send feedback
            </>
          )}
        </Button>
      </div>
    </form>
  );
}
