'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import posthog from 'posthog-js';
import { toast } from 'sonner';
import {
  BarChart3,
  Bed,
  Building2,
  CalendarCheck,
  CreditCard,
  Globe,
  Hotel,
  LayoutDashboard,
  LogOut,
  Menu,
  MessageCircle,
  Plus,
  ShieldAlert,
  ShieldCheck,
  User,
  UserRound,
  Wallet,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { BrandLink } from '@/components/shell/side-nav';
import { Sheet, SheetContent, SheetDescription, SheetTitle } from '@/components/ui/sheet';
import { ConfirmationDialog } from '@/components/ui/confirmation-dialog';
import { UserAvatar } from '@/components/ui/user-avatar';
import { createClient } from '@/lib/auth/client';
import { cn } from '@/lib/utils/cn';

interface NavLink {
  href: string;
  label: string;
  icon: LucideIcon;
  exact?: boolean;
  /** Extra path prefixes that mark this link active (e.g. the create and edit screens of a section). */
  match?: string[];
}

const NAV_GROUPS: Array<{ title?: string; links: NavLink[] }> = [
  { links: [{ href: '/dashboard', label: 'Overview', icon: LayoutDashboard, exact: true }] },
  {
    title: 'Properties',
    links: [
      { href: '/dashboard/listings', label: 'My listings', icon: Building2, match: ['/dashboard/new', '/dashboard/edit'] },
      { href: '/dashboard/bnb', label: 'RumiaBnB', icon: Bed },
      { href: '/dashboard/hostels', label: 'Hostels directory', icon: Hotel },
    ],
  },
  {
    title: 'Students',
    links: [
      { href: '/dashboard/leads', label: 'Leads', icon: MessageCircle },
      { href: '/dashboard/tours', label: 'Tours', icon: CalendarCheck },
    ],
  },
  {
    title: 'Business',
    links: [
      { href: '/dashboard/analytics', label: 'Analytics', icon: BarChart3 },
      { href: '/dashboard/earnings', label: 'Earnings', icon: Wallet },
      { href: '/dashboard/payment', label: 'Payment details', icon: CreditCard },
      { href: '/dashboard/profile', label: 'Profile', icon: User },
    ],
  },
];

const ALL_LINKS = NAV_GROUPS.flatMap((g) => g.links);

function isActive(pathname: string, link: NavLink): boolean {
  if (link.exact) return pathname === link.href;
  return [link.href, ...(link.match ?? [])].some((p) => pathname === p || pathname.startsWith(`${p}/`));
}

interface AgentShellProps {
  agentName: string;
  userEmail: string;
  isAdmin: boolean;
  isManager: boolean;
  children: React.ReactNode;
}

function SidebarBody({
  agentName,
  userEmail,
  isAdmin,
  isManager,
  pathname,
  onNavigate,
  onSignOut,
}: Omit<AgentShellProps, 'children'> & { pathname: string; onNavigate?: () => void; onSignOut: () => void }) {
  const workspaces: NavLink[] = [
    ...(isAdmin ? [{ href: '/admin', label: 'Admin', icon: ShieldAlert }] : []),
    ...(isManager ? [{ href: '/manager', label: 'Manager', icon: ShieldCheck }] : []),
    { href: '/account', label: 'Student account', icon: UserRound },
    { href: '/', label: 'Public site', icon: Globe },
  ];

  return (
    <div className="flex h-full flex-col">
      <div className="flex h-16 shrink-0 items-center gap-2 px-5">
        <BrandLink onNavigate={onNavigate} />
        <span className="rounded-md bg-primary/10 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-[0.12em] text-primary">
          Agent
        </span>
      </div>

      <div className="px-4 pb-2">
        <Link
          href="/dashboard/new"
          onClick={onNavigate}
          className="flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-ink text-sm font-semibold text-page shadow-sm transition-opacity hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
        >
          <Plus className="h-4 w-4" aria-hidden />
          New listing
        </Link>
      </div>

      <nav aria-label="Dashboard" className="flex-1 space-y-6 overflow-y-auto px-3 py-4">
        {NAV_GROUPS.map((group, i) => (
          <div key={group.title ?? i}>
            {group.title && (
              <p className="mb-1.5 px-3 text-[11px] font-semibold uppercase tracking-[0.1em] text-ink-muted">{group.title}</p>
            )}
            <ul className="space-y-0.5">
              {group.links.map((link) => {
                const active = isActive(pathname, link);
                const Icon = link.icon;
                return (
                  <li key={link.href}>
                    <Link
                      href={link.href}
                      onClick={onNavigate}
                      aria-current={active ? 'page' : undefined}
                      className={cn(
                        'relative flex h-10 items-center gap-3 rounded-lg px-3 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary',
                        active ? 'bg-subtle text-ink' : 'text-ink-muted hover:bg-subtle/70 hover:text-ink',
                      )}
                    >
                      {active && <span className="absolute inset-y-2 left-0 w-[3px] rounded-full bg-primary" aria-hidden />}
                      <Icon className={cn('h-[18px] w-[18px] shrink-0', active && 'text-primary')} aria-hidden />
                      {link.label}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}

        <div>
          <p className="mb-1.5 px-3 text-[11px] font-semibold uppercase tracking-[0.1em] text-ink-muted">Switch to</p>
          <ul className="space-y-0.5">
            {workspaces.map(({ href, label, icon: Icon }) => (
              <li key={href}>
                <Link
                  href={href}
                  onClick={onNavigate}
                  className="flex h-10 items-center gap-3 rounded-lg px-3 text-sm font-medium text-ink-muted transition-colors hover:bg-subtle/70 hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                >
                  <Icon className="h-[18px] w-[18px] shrink-0" aria-hidden />
                  {label}
                </Link>
              </li>
            ))}
          </ul>
        </div>
      </nav>

      <div className="border-t border-line p-3">
        <div className="flex items-center gap-3 rounded-xl px-2 py-2">
          <UserAvatar name={agentName || userEmail || 'Agent'} size="md" />
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold text-ink">{agentName || 'Agent'}</p>
            <p className="truncate text-xs text-ink-muted">{userEmail}</p>
          </div>
          <button
            type="button"
            onClick={onSignOut}
            aria-label="Sign out"
            title="Sign out"
            className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-ink-muted transition-colors hover:bg-subtle hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
          >
            <LogOut className="h-[18px] w-[18px]" aria-hidden />
          </button>
        </div>
      </div>
    </div>
  );
}

/**
 * Agent workspace frame. Desktop: a fixed sidebar with grouped sections, workspace switching and the signed-in agent.
 * Phones: a slim top bar (menu, brand, new listing) and a scrollable row of section chips, so every section is one
 * tap away without opening the menu.
 */
export function AgentShell({ agentName, userEmail, isAdmin, isManager, children }: AgentShellProps) {
  const pathname = usePathname();
  const router = useRouter();
  const [menuOpen, setMenuOpen] = useState(false);
  const [confirmSignOut, setConfirmSignOut] = useState(false);
  const [signingOut, setSigningOut] = useState(false);

  const requestSignOut = () => {
    setMenuOpen(false);
    setConfirmSignOut(true);
  };

  const handleSignOut = async () => {
    setSigningOut(true);
    try {
      posthog.capture('user_signed_out');
      posthog.reset();
      const { error } = await createClient().auth.signOut({ scope: 'local' });
      if (error) throw error;
      router.push('/auth/login');
      router.refresh();
    } catch {
      toast.error('Could not sign out. Please try again.');
      setSigningOut(false);
    }
  };

  const sidebarProps = { agentName, userEmail, isAdmin, isManager, pathname, onSignOut: requestSignOut };

  return (
    <div className="min-h-dvh bg-page text-ink lg:pl-64">
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 border-r border-line bg-raised lg:block">
        <SidebarBody {...sidebarProps} />
      </aside>

      {/* Phones and tablets */}
      <header className="sticky top-0 z-30 border-b border-line bg-raised/95 backdrop-blur supports-[backdrop-filter]:bg-raised/80 lg:hidden">
        <div className="flex h-14 items-center justify-between gap-2 px-2 sm:px-4">
          <button
            type="button"
            onClick={() => setMenuOpen(true)}
            aria-label="Open dashboard menu"
            className="inline-flex h-11 w-11 items-center justify-center rounded-lg text-ink transition-colors hover:bg-subtle focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
          >
            <Menu className="h-5 w-5" aria-hidden />
          </button>
          <BrandLink />
          <Link
            href="/dashboard/new"
            aria-label="New listing"
            className="inline-flex h-11 w-11 items-center justify-center rounded-full bg-ink text-page transition-opacity hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
          >
            <Plus className="h-5 w-5" aria-hidden />
          </Link>
        </div>
      </header>
      <nav aria-label="Dashboard sections" className="border-b border-line bg-raised lg:hidden">
        <ul className="flex gap-2 overflow-x-auto px-4 py-2.5 scrollbar-hide">
          {ALL_LINKS.map((link) => {
            const active = isActive(pathname, link);
            const Icon = link.icon;
            return (
              <li key={link.href} className="shrink-0">
                <Link
                  href={link.href}
                  aria-current={active ? 'page' : undefined}
                  className={cn(
                    'inline-flex h-10 items-center gap-1.5 rounded-full border px-3.5 text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary',
                    active ? 'border-ink bg-ink text-page' : 'border-line bg-raised text-ink-muted active:bg-subtle',
                  )}
                >
                  <Icon className="h-4 w-4" aria-hidden />
                  {link.label}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

      <Sheet open={menuOpen} onOpenChange={setMenuOpen}>
        <SheetContent side="left" className="w-[85%] max-w-xs border-line bg-raised p-0">
          <SheetTitle className="sr-only">Dashboard menu</SheetTitle>
          <SheetDescription className="sr-only">Sections of your agent dashboard</SheetDescription>
          <SidebarBody {...sidebarProps} onNavigate={() => setMenuOpen(false)} />
        </SheetContent>
      </Sheet>

      <main className="mx-auto w-full max-w-6xl px-4 pb-12 pt-6 sm:px-6 lg:px-10 lg:pb-16 lg:pt-10">{children}</main>

      <ConfirmationDialog
        isOpen={confirmSignOut}
        onClose={() => setConfirmSignOut(false)}
        onConfirm={handleSignOut}
        isConfirming={signingOut}
        variant="danger"
        title="Sign out?"
        description="You'll need to sign in again to manage your listings and leads."
        confirmText="Sign out"
      />
    </div>
  );
}
