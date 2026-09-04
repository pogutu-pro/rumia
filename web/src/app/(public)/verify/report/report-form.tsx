'use client';

import { useState } from 'react';
import { Flag, AlertTriangle, MessageSquare, Phone, CheckCircle2, ArrowRight, ExternalLink } from 'lucide-react';
import { cn } from '@/lib/utils/cn';
import { buildWhatsAppUrl } from '@/lib/utils/phone';

type IssueType =
  | 'wrong_number'
  | 'wrong_payment'
  | 'impersonating'
  | 'scam'
  | 'other';

const ISSUE_OPTIONS: { key: IssueType; label: string; description: string }[] = [
  {
    key: 'wrong_number',
    label: 'Wrong phone number',
    description: 'The number shared with me differs from the official record',
  },
  {
    key: 'wrong_payment',
    label: 'Suspicious payment details',
    description: 'I was given a Paybill/Till that does not match the official record',
  },
  {
    key: 'impersonating',
    label: 'Impersonating a hostel',
    description: 'Someone is pretending to be from a hostel I verified',
  },
  {
    key: 'scam',
    label: 'Possible scam / fraud',
    description: 'I was asked to pay before seeing the room or signing any agreement',
  },
  {
    key: 'other',
    label: 'Other concern',
    description: 'I have a different issue to report',
  },
];

interface ReportFormProps {
  whatsappNumber: string;
}

export function ReportForm({ whatsappNumber }: ReportFormProps) {
  const [issueType, setIssueType] = useState<IssueType | null>(null);
  const [contactReported, setContactReported] = useState('');
  const [details, setDetails] = useState('');
  const [submitted, setSubmitted] = useState(false);

  const selectedOption = ISSUE_OPTIONS.find((o) => o.key === issueType);

  const whatsappMessage = `[Rumia Hostel Report]\nIssue: ${selectedOption?.label || 'General report'}\nContact reported: ${contactReported || 'N/A'}\nDetails: ${details || 'N/A'}`;
  const whatsappUrl = buildWhatsAppUrl(whatsappNumber, whatsappMessage);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!issueType) return;
    // Open WhatsApp with pre-filled message as the submission mechanism
    window.open(whatsappUrl, '_blank', 'noopener,noreferrer');
    setSubmitted(true);
  }

  function reset() {
    setSubmitted(false);
    setIssueType(null);
    setContactReported('');
    setDetails('');
  }

  if (submitted) {
    return (
      <div className="rounded-2xl border border-[#1B1B18]/10 bg-white overflow-hidden">
        <div className="px-5 py-3 sm:px-6">
          <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-emerald-600">
            <CheckCircle2 className="h-4 w-4" />
            Report sent
          </div>
        </div>
        <div className="px-5 pb-6 sm:px-6 space-y-5">
          <p className="text-sm text-[#1B1B18]/70 leading-relaxed">
            Thank you for helping keep the community safe. We&apos;ve received your
            report and will investigate within 24 hours. If the WhatsApp tab
            didn&apos;t open,{' '}
            <a
              href={whatsappUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="font-semibold text-emerald-700 hover:underline"
            >
              tap here to send it manually
            </a>
            .
          </p>

          <div className="rounded-xl border border-[#1B1B18]/10 bg-[#F7F5F0] p-4 text-sm">
            <p className="font-semibold text-[#1B1B18]">Your report summary</p>
            <dl className="mt-3 space-y-1.5 text-xs">
              <div className="flex justify-between gap-3">
                <dt className="text-[#1B1B18]/50">Issue</dt>
                <dd className="font-semibold text-[#1B1B18] text-right">
                  {selectedOption?.label}
                </dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-[#1B1B18]/50">Contact reported</dt>
                <dd className="font-mono font-semibold text-[#1B1B18] text-right">
                  {contactReported || 'N/A'}
                </dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-[#1B1B18]/50">Details</dt>
                <dd className="font-semibold text-[#1B1B18] text-right max-w-[60%] truncate">
                  {details || 'N/A'}
                </dd>
              </div>
            </dl>
          </div>

          <button
            type="button"
            onClick={reset}
            className="inline-flex items-center gap-2 rounded-xl border border-[#1B1B18]/10 px-4 py-2.5 text-sm font-semibold text-[#1B1B18]/70 hover:bg-[#F7F5F0] transition-colors"
          >
            Submit another report
          </button>
        </div>
      </div>
    );
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="rounded-2xl border border-[#1B1B18]/10 bg-white overflow-hidden"
    >
      <div className="px-5 py-3 sm:px-6 border-b border-[#1B1B18]/5">
        <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-[#1B1B18]/40">
          <Flag className="h-4 w-4" />
          Report a Concern
        </div>
      </div>

      <div className="px-5 py-6 sm:px-6 space-y-6">
        {/* Issue type */}
        <div>
          <label className="block text-xs font-bold uppercase tracking-wider text-[#1B1B18]/40 mb-3">
            What would you like to report?
          </label>
          <div className="space-y-2">
            {ISSUE_OPTIONS.map((option) => (
              <button
                key={option.key}
                type="button"
                onClick={() => setIssueType(option.key)}
                className={cn(
                  'w-full flex items-start gap-3 rounded-xl border px-4 py-3 text-left transition-colors',
                  issueType === option.key
                    ? 'border-slate-900 bg-slate-900 text-white'
                    : 'border-slate-200 hover:bg-slate-50 text-slate-700',
                )}
              >
                <span
                  className={cn(
                    'mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full border-2 transition-colors',
                    issueType === option.key
                      ? 'border-white bg-white'
                      : 'border-slate-300',
                  )}
                >
                  {issueType === option.key && (
                    <span className="h-2 w-2 rounded-full bg-slate-900" />
                  )}
                </span>
                <div>
                  <p className={cn('font-semibold text-sm', issueType === option.key ? 'text-white' : 'text-slate-800')}>
                    {option.label}
                  </p>
                  <p className={cn('text-xs mt-0.5', issueType === option.key ? 'text-white/70' : 'text-slate-400')}>
                    {option.description}
                  </p>
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* Contact being reported */}
        <div>
          <label className="block text-xs font-bold uppercase tracking-wider text-[#1B1B18]/40 mb-2">
            Phone or payment number you were given
          </label>
          <div className="relative">
            <Phone className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 pointer-events-none" />
            <input
              type="text"
              value={contactReported}
              onChange={(e) => setContactReported(e.target.value)}
              placeholder="e.g. 0712 345 678 or Paybill 247247"
              inputMode="text"
              className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-200 bg-slate-50 text-sm text-slate-800 placeholder:text-slate-400 focus:outline-none focus:border-slate-400 focus:bg-white transition-colors"
            />
          </div>
        </div>

        {/* Details */}
        <div>
          <label className="block text-xs font-bold uppercase tracking-wider text-[#1B1B18]/40 mb-2">
            <MessageSquare className="inline h-3 w-3 mr-1" />
            Additional details (optional)
          </label>
          <textarea
            value={details}
            onChange={(e) => setDetails(e.target.value)}
            placeholder="Describe what happened…"
            rows={3}
            className="w-full px-4 py-2.5 rounded-xl border border-slate-200 bg-slate-50 text-sm text-slate-800 placeholder:text-slate-400 focus:outline-none focus:border-slate-400 focus:bg-white transition-colors resize-none"
          />
        </div>

        {/* Warning note */}
        <div className="flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs text-amber-700">
          <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5 text-amber-500" />
          <p>
            Your report opens WhatsApp with a pre-filled message to Rumia support. We
            review all reports and will never share your identity.
          </p>
        </div>

        {/* Submit */}
        <button
          type="submit"
          disabled={!issueType}
          className={cn(
            'w-full flex items-center justify-center gap-2 rounded-xl px-5 py-3.5 text-sm font-bold transition-all',
            issueType
              ? 'bg-slate-900 text-white hover:bg-slate-800 active:scale-[0.98]'
              : 'bg-slate-100 text-slate-400 cursor-not-allowed',
          )}
        >
          <Flag className="h-4 w-4" />
          Send Report via WhatsApp
          <ArrowRight className="h-4 w-4" />
        </button>

        {/* Alternate: email */}
        <div className="text-center">
          <p className="text-xs text-slate-400 mb-2">Or send us an email</p>
          <a
            href="mailto:contact@rumiamanage.com?subject=Hostel%20Report"
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-600 hover:text-slate-900 transition-colors"
          >
            contact@rumiamanage.com
            <ExternalLink className="h-3 w-3" />
          </a>
        </div>
      </div>
    </form>
  );
}
