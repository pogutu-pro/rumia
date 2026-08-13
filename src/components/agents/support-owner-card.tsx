'use client';

import Link from 'next/link';
import { Crown, MessageCircle, Loader2, UserRound } from 'lucide-react';
import { UserAvatar } from '@/components/ui/user-avatar';
import { buildWhatsAppUrl, agentInquiryMessage } from '@/lib/utils/phone';
import { useGatedWhatsApp } from '@/hooks/use-gated-whatsapp';

export interface SupportOwnerCardProps {
  agent: {
    id: string | number;
    name: string;
    slug?: string | null;
    profile_photo_url?: string | null;
    bio?: string | null;
    whatsapp: string;
    verified?: boolean | null;
    support_rank?: number | null;
    pochi_la_biashara_number?: string | null;
    expected_name?: string | null;
  };
}

export function SupportOwnerCard({ agent }: SupportOwnerCardProps) {
  const whatsappUrl = buildWhatsAppUrl(
    agent.whatsapp,
    agentInquiryMessage({
      agentName: agent.name,
      whatsapp: agent.whatsapp,
      pochiLaBiasharaNumber: agent.pochi_la_biashara_number,
      expectedName: agent.expected_name,
    }),
  );

  const { isGating, handleClick } = useGatedWhatsApp({
    storageKey: 'rumia_pending_owner_whatsapp',
    contactId: agent.id,
    whatsappUrl,
  });

  const profileUrl = agent.slug ? `/agents/${agent.slug}` : null;

  return (
    <div className="rounded-3xl border border-slate-200 bg-white shadow-sm">
      <div className="flex flex-col sm:flex-row sm:items-center gap-5 p-6 sm:p-8">
        <div className="relative shrink-0 self-center sm:self-auto">
          <UserAvatar
            name={agent.name}
            imageUrl={agent.profile_photo_url}
            size="xl"
            className="ring-1 ring-slate-200"
          />
          <span
            className="absolute -bottom-1 -right-1 flex h-7 w-7 items-center justify-center rounded-full bg-white ring-1 ring-slate-200"
            title="Platform owner"
            aria-label="Platform owner"
          >
            <Crown className="h-4 w-4 text-amber-600" aria-hidden="true" />
          </span>
        </div>

        <div className="flex-1 min-w-0 text-center sm:text-left">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-50 border border-amber-200/60 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-amber-700">
            <Crown className="h-3 w-3" />
            Platform Owner
          </span>
          <h3 className="mt-2 text-xl sm:text-2xl font-bold text-slate-900 tracking-tight">
            {agent.name}
          </h3>
          <p className="mt-1 text-sm text-slate-600">
            Rumia&apos;s main support — personally helping students verify before they pay.
          </p>
          {agent.bio && (
            <p className="mt-2 text-sm text-slate-500 leading-relaxed max-w-xl line-clamp-2">
              {agent.bio}
            </p>
          )}
        </div>

        <div className="flex items-center justify-center gap-2 sm:flex-col sm:items-stretch">
          <a
            href={whatsappUrl}
            target="_blank"
            rel="noopener noreferrer"
            onClick={handleClick}
            className="inline-flex items-center justify-center gap-2 h-11 rounded-xl bg-emerald-600 px-5 text-sm font-semibold text-white shadow-sm transition-all hover:bg-emerald-500 active:scale-[0.98] focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500"
            aria-label={`Contact ${agent.name}, platform owner, on WhatsApp`}
          >
            {isGating ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <MessageCircle className="h-4 w-4 fill-current" />
            )}
            {isGating ? 'Checking…' : 'WhatsApp'}
          </a>
          {profileUrl && (
            <Link
              href={profileUrl}
              className="inline-flex items-center justify-center gap-2 h-11 rounded-xl border border-slate-200 px-5 text-sm font-semibold text-slate-700 transition-all hover:bg-slate-50 active:scale-[0.98] focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500"
            >
              <UserRound className="h-4 w-4" />
              View Profile
            </Link>
          )}
        </div>
      </div>
    </div>
  );
}
