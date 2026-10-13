'use client';

import * as React from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ChevronDown, LayoutDashboard, LogOut, Settings, ShieldAlert, ShieldCheck, User } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { UserAvatar } from '@/components/ui/user-avatar';
import { signOut } from '@/lib/auth/actions';
import { useShell } from './shell-provider';

export function ProfileMenu() {
  const { auth } = useShell();
  const router = useRouter();

  if (auth.status === 'loading') {
    return <div className="h-10 w-10 animate-pulse rounded-full bg-subtle" aria-hidden />;
  }

  if (auth.status === 'signed-out') {
    return (
      <Link
        href="/auth/login"
        className="inline-flex h-10 items-center rounded-full bg-primary px-4 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
      >
        Sign in
      </Link>
    );
  }

  const { user } = auth;
  const name = user.fullName || user.email || 'Account';

  const handleSignOut = async () => {
    await signOut();
    router.push('/');
    router.refresh();
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        aria-label={`Account menu for ${name}`}
        className="flex h-10 items-center gap-2 rounded-full border border-transparent py-1 pl-1 pr-2 transition-colors hover:bg-subtle focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary data-[state=open]:bg-subtle"
      >
        <UserAvatar name={name} imageUrl={user.avatarUrl} size="sm" />
        <span className="hidden max-w-[10rem] truncate text-sm font-medium text-ink md:block">{user.fullName ?? 'Account'}</span>
        <ChevronDown className="hidden h-4 w-4 text-ink-muted md:block" aria-hidden />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-60">
        <DropdownMenuLabel className="font-normal">
          <p className="truncate text-sm font-semibold text-ink">{user.fullName ?? 'Your account'}</p>
          {user.email && <p className="truncate text-xs text-ink-muted">{user.email}</p>}
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild>
          <Link href="/account">
            <User /> Account
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <Link href="/account?tab=settings">
            <Settings /> Account settings
          </Link>
        </DropdownMenuItem>
        {(user.hasAgent || user.isManager || user.isAdmin) && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuLabel className="text-xs font-medium text-ink-muted">Workspaces</DropdownMenuLabel>
            {user.hasAgent && (
              <DropdownMenuItem asChild>
                <Link href="/dashboard">
                  <LayoutDashboard /> Agent dashboard
                </Link>
              </DropdownMenuItem>
            )}
            {user.isManager && (
              <DropdownMenuItem asChild>
                <Link href="/manager">
                  <ShieldCheck /> Manager
                </Link>
              </DropdownMenuItem>
            )}
            {user.isAdmin && (
              <DropdownMenuItem asChild>
                <Link href="/admin">
                  <ShieldAlert /> Admin
                </Link>
              </DropdownMenuItem>
            )}
          </>
        )}
        <DropdownMenuSeparator />
        <DropdownMenuItem onSelect={() => void handleSignOut()}>
          <LogOut /> Sign out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
