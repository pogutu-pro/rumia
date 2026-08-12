'use client';

import { useState, useTransition } from 'react';
import { AlertTriangle, Send, CheckCircle2 } from 'lucide-react';
import { sendSuspensionMessageAction } from '@/app/actions/agents';
import { toast } from 'sonner';

interface SuspensionBannerProps {
  agentName: string;
  suspensionReason: string;
}

export function SuspensionBanner({ agentName, suspensionReason }: SuspensionBannerProps) {
  const [message, setMessage] = useState('');
  const [sent, setSent] = useState(false);
  const [isPending, startTransition] = useTransition();

  const handleSend = () => {
    if (!message.trim()) return;
    startTransition(async () => {
      const result = await sendSuspensionMessageAction(message.trim());
      if (result.success) {
        setSent(true);
        toast.success('Message sent to admin/manager');
      } else {
        toast.error(result.error);
      }
    });
  };

  return (
    <div className="max-w-xl mx-auto mt-12 space-y-6">
      <div className="bg-rose-50 border border-rose-200 rounded-2xl p-6 space-y-4">
        <div className="flex items-start gap-3">
          <AlertTriangle className="h-6 w-6 text-rose-500 shrink-0 mt-0.5" />
          <div className="space-y-1">
            <p className="font-bold text-rose-900 text-base">Your account has been suspended</p>
            <p className="text-sm text-rose-800">
              Hi {agentName.split(' ')[0]}, your agent account is currently suspended. You cannot post new hostels until this is resolved and your account is reinstated by an admin or manager.
            </p>
          </div>
        </div>

        <div className="bg-white border border-rose-100 rounded-xl p-4 space-y-1">
          <p className="text-xs font-semibold text-rose-700 uppercase tracking-wider">Reason</p>
          <p className="text-sm text-slate-800">{suspensionReason}</p>
        </div>
      </div>

      {/* Appeal section */}
      <div className="bg-white border border-slate-200 rounded-2xl p-6 space-y-4">
        <div>
          <p className="font-semibold text-slate-900 text-sm">Resolved the issue?</p>
          <p className="text-xs text-slate-500 mt-0.5">
            If you believe the issue has been resolved, send a message to the admin/manager explaining what you have done. They will review and reinstate your account.
          </p>
        </div>

        {sent ? (
          <div className="flex items-center gap-2 p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-sm text-emerald-800">
            <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
            Message sent. The admin/manager will review your appeal and get back to you.
          </div>
        ) : (
          <>
            <textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="Explain what you have done to resolve the issue..."
              rows={4}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-slate-900 resize-none"
            />
            <button
              disabled={isPending || !message.trim()}
              onClick={handleSend}
              className="inline-flex items-center gap-2 px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white text-sm font-semibold rounded-xl transition-colors disabled:opacity-50"
            >
              <Send className="h-4 w-4" />
              {isPending ? 'Sending...' : 'Send Message to Admin'}
            </button>
          </>
        )}
      </div>
    </div>
  );
}
