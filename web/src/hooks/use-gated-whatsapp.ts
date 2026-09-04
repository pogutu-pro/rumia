'use client';

import { useEffect, useRef, useState } from 'react';
import { getSession, signInWithGoogle } from '@/lib/supabase/auth';

interface GatedWhatsAppOptions {
  /** sessionStorage key used to persist the pending contact across OAuth redirect. */
  storageKey: string;
  /** Stable id so the resume flow only opens for the contact that was tapped. */
  contactId: string | number;
  /** The wa.me URL to open once the user is signed in. */
  whatsappUrl: string;
}

interface PendingContact {
  contactId: string;
  whatsappUrl: string;
}

function savePending(storageKey: string, pending: PendingContact) {
  try {
    sessionStorage.setItem(storageKey, JSON.stringify(pending));
  } catch {}
}

function consumePending(storageKey: string): PendingContact | null {
  try {
    const raw = sessionStorage.getItem(storageKey);
    if (!raw) return null;
    sessionStorage.removeItem(storageKey);
    return JSON.parse(raw) as PendingContact;
  } catch {
    return null;
  }
}

/**
 * Gates a WhatsApp contact link behind a sign-in.
 *
 * If the visitor is not authenticated they are sent through Google OAuth
 * (with a return-to-path redirect). The pending contact is stored in
 * sessionStorage so the WhatsApp tab is opened automatically when they come
 * back — without them having to re-tap the link.
 *
 * Used by the footer WhatsApp icon, the support owner card and agent cards so
 * nobody bypasses sign-in (e.g. before contacting support/agents).
 */
export function useGatedWhatsApp({ storageKey, contactId, whatsappUrl }: GatedWhatsAppOptions) {
  const [isGating, setIsGating] = useState(false);
  const resumeChecked = useRef(false);

  // Resume flow if returning from OAuth redirect (runs once on mount).
  useEffect(() => {
    if (resumeChecked.current) return;
    resumeChecked.current = true;
    const pending = consumePending(storageKey);
    if (pending && pending.contactId === String(contactId)) {
      window.open(pending.whatsappUrl, '_blank', 'noopener,noreferrer');
    }
  }, [storageKey, contactId]);

  const handleClick = async (e: React.MouseEvent<HTMLAnchorElement>) => {
    e.preventDefault();
    e.stopPropagation();
    if (isGating) return;
    setIsGating(true);

    try {
      const { session } = await getSession();
      if (!session?.user) {
        savePending(storageKey, { contactId: String(contactId), whatsappUrl });
        const { error } = await signInWithGoogle(window.location.pathname);
        if (error) {
          setIsGating(false);
          return;
        }
        return; // OAuth redirect in progress; resume happens on mount
      }
      window.open(whatsappUrl, '_blank', 'noopener,noreferrer');
    } catch {
      setIsGating(false);
      window.open(whatsappUrl, '_blank', 'noopener,noreferrer');
    } finally {
      setIsGating(false);
    }
  };

  return { isGating, handleClick };
}
