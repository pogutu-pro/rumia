'use client';

import * as React from 'react';
import Link from 'next/link';
import { useRouter, usePathname } from 'next/navigation';

const CUR = 'rumia:nav:cur';
const PREV = 'rumia:nav:prev';

/** Remembers the previous in-app page so a detail page can send people back to where they came from. */
export function NavHistoryTracker() {
  const pathname = usePathname();
  React.useEffect(() => {
    try {
      const here = pathname + window.location.search;
      const cur = sessionStorage.getItem(CUR);
      if (cur && cur !== here) sessionStorage.setItem(PREV, cur);
      sessionStorage.setItem(CUR, here);
    } catch {
      /* storage unavailable: the back link falls back to its default target */
    }
  }, [pathname]);
  return null;
}

interface ContextBackLinkProps extends Omit<React.ComponentProps<typeof Link>, 'href' | 'onClick'> {
  /** Where to go when there is no in-app page to return to (opened from a shared link, for example). */
  fallbackHref: string;
}

/**
 * Goes back in history when the person arrived from another Rumia page, which restores the previous search
 * parameters and scroll position. Otherwise it is an ordinary link to `fallbackHref`.
 */
export function ContextBackLink({ fallbackHref, children, ...props }: ContextBackLinkProps) {
  const router = useRouter();
  return (
    <Link
      {...props}
      href={fallbackHref}
      onClick={(e) => {
        if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0) return;
        try {
          const prev = sessionStorage.getItem(PREV);
          const here = window.location.pathname + window.location.search;
          if (prev && prev !== here && window.history.length > 1) {
            e.preventDefault();
            router.back();
          }
        } catch {
          /* fall through to the link */
        }
      }}
    >
      {children}
    </Link>
  );
}
