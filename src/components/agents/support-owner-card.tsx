'use client';

import Link from 'next/link';
import { Crown, MessageCircle, Loader2, ShieldCheck, UserRound } from 'lucide-react';
import { UserAvatar } from '@/components/ui/user-avatar';
import { buildWhatsAppUrl, ownerSupportMessage } from '@/lib/utils/phone';
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
  className?: string;
}

export function SupportOwnerCard({ agent, className }: SupportOwnerCardProps) {
  const whatsappUrl = buildWhatsAppUrl(
    agent.whatsapp,
    ownerSupportMessage({
      ownerName: agent.name,
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
    <div
      className={className ?? ''}
    >
      <div className="group relative flex h-full flex-col justify-between overflow-hidden rounded-2xl bg-white border border-slate-200 shadow-sm transition-all duration-200 hover:shadow-md hover:border-slate-300 md:hover:-translate-y-0.5 active:scale-[0.99] md:active:scale-100">
        <div className="p-5 sm:p-6">
          <div className="flex items-start gap-4">
            <div className="shrink-0 relative">
              <UserAvatar
                name={agent.name}
                imageUrl={agent.profile_photo_url}
                size="lg"
                className="ring-2 ring-amber-100"
              />
              <span
                className="absolute -bottom-0.5 -right-0.5 flex h-6 w-6 items-center justify-center rounded-full bg-white ring-2 ring-white"
                title="Platform owner"
                aria-label="Platform owner"
              >
                <Crown className="h-3.5 w-3.5 text-amber-600" aria-hidden="true" />
              </span>
            </div>

            <div className="min-w-0 flex-1">
              <h3 className="font-extrabold text-[15px] text-slate-900 leading-snug truncate">
                {agent.name}
              </h3>
              <div className="flex flex-wrap gap-1.5 mt-1.5">
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-50 border border-amber-200/70 text-amber-700 text-[9px] font-bold uppercase tracking-wider">
                  <Crown className="h-2.5 w-2.5" aria-hidden="true" />
                  Platform Owner
                </span>
                {agent.verified && (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-50 border border-emerald-100 text-emerald-700 text-[9px] font-bold uppercase tracking-wider">
                    <ShieldCheck className="h-2.5 w-2.5" aria-hidden="true" />
                    Verified
                  </span>
                )}
              </div>
              {agent.bio ? (
                <p className="text-xs text-slate-500 mt-2 line-clamp-2 leading-relaxed">
                  {agent.bio}
                </p>
              ) : (
                <p className="text-xs text-slate-600 mt-2 leading-relaxed">
                  Rumia&apos;s main support — personally helping students verify before they pay.
                </p>
              )}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2 px-5 py-4 border-t border-slate-100">
          <a
            href={whatsappUrl}
            target="_blank"
            rel="noopener noreferrer"
            onClick={handleClick}
            className="flex-1 inline-flex items-center justify-center gap-1.5 h-10 rounded-xl text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-500 shadow-sm hover:shadow transition-all duration-200 active:scale-[0.97] focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500"
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
              className="flex-1 inline-flex items-center justify-center gap-1 h-10 rounded-xl text-xs font-bold border border-slate-200 hover:border-slate-300 hover:bg-slate-50 text-slate-700 transition-all duration-200 active:scale-[0.97] focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500"
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
