import { Compass, Heart, Home, PlaySquare, ShieldCheck, User } from 'lucide-react';
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

/**
 * Phone bottom bar (below `lg`). Verify is not here: it lives in the Account hub and on Home, and stays in the
 * desktop sidebar. Account points at the login page for signed-out visitors (see BottomNav).
 */
export const MOBILE_NAV: NavItem[] = [
  PRIMARY_NAV[0],
  PRIMARY_NAV[1],
  PRIMARY_NAV[2],
  PRIMARY_NAV[3],
  {
    href: '/account',
    label: 'Account',
    icon: User,
    match: ['/account', '/auth', '/dashboard', '/admin', '/manager', '/verify', '/agents', '/agent/', '/listers', '/policy', '/terms'],
  },
];

/**
 * Routes where the bottom bar steps aside: property pages (their own Contact / Book a tour bar owns the bottom edge)
 * and sign-in / offline screens.
 */
export function isBottomNavHidden(pathname: string): boolean {
  if (/^\/hostels\/[^/]+\/[^/]+\/[^/]+\/?$/.test(pathname)) return true; // old /hostels/[county]/[area]/[slug]
  if (/^\/[^/]+\/(student-hostels|apartments|short-stays)\/[^/]+\/[^/]+\/?$/.test(pathname)) return true; // /[market]/[type]/[place]/[name]
  if (/^\/(bnb|listing|p)\/[^/]+\/?$/.test(pathname)) return true;
  return /^\/(auth|offline)(\/|$)/.test(pathname);
}
