import { Compass, Heart, Home, PlaySquare, ShieldCheck } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

export interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
  /** Path prefixes that mark this item active (the href itself is always included). */
  match?: string[];
  exact?: boolean;
}

/** Primary destinations. Every href is an existing route. Profile lives in the top-right menu. */
export const PRIMARY_NAV: NavItem[] = [
  { href: '/', label: 'Home', icon: Home, exact: true },
  {
    href: '/hostels',
    label: 'Explore',
    icon: Compass,
    match: ['/hostels', '/bnb', '/browse', '/search', '/areas', '/near', '/p/', '/listing'],
  },
  { href: '/videos', label: 'Videos', icon: PlaySquare },
  { href: '/saved', label: 'Wishlist', icon: Heart, match: ['/saved', '/compare'] },
  { href: '/verify', label: 'Verify', icon: ShieldCheck, match: ['/verify', '/agents', '/agent/', '/listers'] },
];

export const LEGAL_NAV = [
  { href: '/policy', label: 'Privacy' },
  { href: '/terms', label: 'Terms of Service' },
] as const;

export function isNavActive(pathname: string, item: NavItem): boolean {
  if (item.exact) return pathname === item.href;
  const prefixes = item.match ?? [item.href];
  return prefixes.some((p) => (p.endsWith('/') ? pathname.startsWith(p) : pathname === p || pathname.startsWith(`${p}/`)));
}
