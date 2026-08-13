'use client';

import { useEffect, useState } from 'react';
import { Crown, MessageCircle, ShieldCheck, Loader2, BadgeCheck } from 'lucide-react';
import { UserAvatar } from '@/components/ui/user-avatar';
import { buildWhatsAppUrl, agentInquiryMessage } from '@/lib/utils/phone';
import { getSession, signInWithGoogle } from '@/lib/supabase/auth';

const PENDING_OWNER_KEY = 'rumia_pending_owner_whatsapp';

function savePendingOwnerContact(ownerId: string | number, whatsappUrl: string) {
  try {
    sessionStorage.setItem(
      PENDING_OWNER_KEY,
      JSON.stringify({ ownerId: String(ownerId), whatsappUrl }),
    );
  } catch {}
}

function consumePendingOwnerContact() {
  try {
    const raw = sessionStorage.getItem(PENDING_OWNER_KEY);
    if (!raw) return null;
    sessionStorage.removeItem(PENDING_OWNER_KEY);
    return JSON.parse(raw) as { ownerId: string; whatsappUrl: string };
  } catch {
    return null;
  }
}

export interface SupportOwnerCardProps {
  agent: {
    id: string | number;
    name: string;
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
  const [isGating, setIsGating] = useState(false);

  const whatsappUrl = buildWhatsAppUrl(
    agent.whatsapp,
    agentInquiryMessage({
      agentName: agent.name,
      whatsapp: agent.whatsapp,
      pochiLaBiasharaNumber: agent.pochi_la_biashara_number,
      expectedName: agent.expected_name,
    }),
  );

  useEffect(() => {
    const pending = consumePendingOwnerContact();
    if (pending && pending.ownerId === String(agent.id)) {
      window.open(pending.whatsappUrl, '_blank', 'noopener,noreferrer');
    }
  }, [agent.id]);

  const handleWhatsAppClick = async (e: React.MouseEvent<HTMLAnchorElement>) => {
    e.preventDefault();
    e.stopPropagation();
    if (isGating) return;
    setIsGating(true);

    try {
      const { session } = await getSession();
      if (!session?.user) {
        savePendingOwnerContact(agent.id, whatsappUrl);
        const { error } = await signInWithGoogle(window.location.pathname);
        if (error) setIsGating(false);
        return;
      }
      window.open(whatsappUrl, '_blank', 'noopener,noreferrer');
    } catch {
      setIsGating(false);
      window.open(whatsappUrl, '_blank', 'noopener,noreferrer');
    } finally {
      setIsGating(false);
    }
  };

  return (
    <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-[#1B1B18] via-[#2a2a26] to-[#1B1B18] text-white shadow-2xl">
      <div className="pointer-events-none absolute inset-0 opacity-[0.06]" aria-hidden="true">
        <div className="absolute -top-24 -right-16 h-72 w-72 rounded-full bg-amber-400 blur-3xl" />
        <div className="absolute -bottom-24 -left-16 h-72 w-72 rounded-full bg-emerald-500 blur-3xl" />
      </div>

      <div className="relative grid gap-6 p-6 sm:p-8 lg:grid-cols-[auto_1fr_auto] lg:items-center">
        {/* Crown badge */}
        <div className="absolute top-5 right-5">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-500/90 px-3 py-1 text-[10px] font-black uppercase tracking-widest text-white shadow-lg shadow-amber-500/30">
            <Crown className="h-3.5 w-3.5 fill-current" />
            Main Support
          </span>
        </div>

        {/* Avatar */}
        <div className="relative shrink-0 justify-self-center lg:justify-self-start">
          <UserAvatar
            name={agent.name}
            imageUrl={agent.profile_photo_url}
            size="2xl"
            className="ring-4 ring-white/20"
          />
          <span
            className="absolute -bottom-1 -right-1 flex h-8 w-8 items-center justify-center rounded-full bg-amber-500 ring-4 ring-[#1B1B18]"
            title="Platform owner / main support"
            aria-label="Platform owner / main support"
          >
            <BadgeCheck className="h-5 w-5 text-white" aria-hidden="true" />
          </span>
        </div>

        {/* Copy */}
        <div className="text-center lg:text-left min-w-0">
          <p className="inline-flex items-center gap-1.5 text-[10px] font-black uppercase tracking-[0.2em] text-amber-300">
            <ShieldCheck className="h-3.5 w-3.5" />
            Platform Owner
          </p>
          <h3 className="mt-1 text-2xl sm:text-3xl font-black tracking-tight">{agent.name}</h3>
          {agent.bio && (
            <p className="mt-2 text-sm text-white/70 leading-relaxed max-w-xl">{agent.bio}</p>
          )}
          <p className="mt-3 text-xs text-white/50">
            Rumia&apos;s main support — the person behind the platform, personally helping students verify before they pay.
          </p>
        </div>

        {/* CTA */}
        <div className="justify-self-center lg:justify-self-end">
          <a
            href={whatsappUrl}
            target="_blank"
            rel="noopener noreferrer"
            onClick={handleWhatsAppClick}
            className="inline-flex items-center gap-2 h-12 rounded-2xl bg-amber-500 px-6 text-sm font-black text-white shadow-lg shadow-amber-500/30 transition-all hover:bg-amber-400 hover:shadow-xl active:scale-[0.97] focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-300"
            aria-label={`Contact ${agent.name}, platform owner, on WhatsApp`}
          >
            {isGating ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <MessageCircle className="h-5 w-5 fill-current" />
            )}
            {isGating ? 'Checking…' : 'Talk to the Owner'}
          </a>
        </div>
      </div>
    </div>
  );
}
