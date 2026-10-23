'use client';

import Link from 'next/link';
import { Crown, Loader2 } from 'lucide-react';
import { FaWhatsapp } from 'react-icons/fa6';
import { UserAvatar } from '@/components/ui/user-avatar';
import { buildWhatsAppUrl, ownerSupportMessage } from '@/lib/utils/phone';
import { useGatedWhatsApp } from '@/hooks/use-gated-whatsapp';
import type { PublicAgent } from '@/lib/api/public';

/**
 * One line in the footer: the platform owner, reachable on WhatsApp from every page (phones included, where the
 * desktop sidebar's Verify link is not). Same owner, message and sign-in gating as the owner card on /verify.
 */
export function OwnerContact({ owner }: { owner: PublicAgent }) {
  const whatsappUrl = buildWhatsAppUrl(
    owner.whatsapp,
    ownerSupportMessage({
      ownerName: owner.name,
      whatsapp: owner.whatsapp,
      pochiLaBiasharaNumber: owner.pochi_la_biashara_number,
      expectedName: owner.expected_name,
    }),
  );
  const { isGating, handleClick } = useGatedWhatsApp({
    storageKey: 'rumia_pending_owner_whatsapp',
    contactId: owner.id,
    whatsappUrl,
  });

  return (
    <div className="flex items-center gap-3 rounded-2xl border border-line bg-raised p-3 sm:p-4">
      <UserAvatar name={owner.name} imageUrl={owner.profile_photo_url} size="md" />
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-bold text-ink">
          {owner.slug ? (
            <Link href={`/agents/${owner.slug}`} className="hover:underline">
              {owner.name}
            </Link>
          ) : (
            owner.name
          )}
        </p>
        <p className="mt-0.5 inline-flex items-center gap-1 text-[11px] font-bold uppercase tracking-wider text-amber-700">
          <Crown className="h-3 w-3" aria-hidden />
          Platform Owner
        </p>
        <p className="text-xs text-ink-muted">Unsure about an agent or a payment? Ask me directly.</p>
      </div>
      <a
        href={whatsappUrl}
        target="_blank"
        rel="noopener noreferrer"
        onClick={handleClick}
        className="inline-flex min-h-11 shrink-0 items-center gap-2 rounded-xl bg-[#25D366] px-3 text-sm font-semibold text-white hover:bg-[#1ebe5b] sm:px-4"
      >
        {isGating ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : <FaWhatsapp className="h-4 w-4" aria-hidden />}
        <span className="hidden sm:inline">WhatsApp</span>
        <span className="sm:hidden">Chat</span>
      </a>
    </div>
  );
}
