'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ChevronLeft, ChevronRight, LogOut } from 'lucide-react';
import { toast } from 'sonner';
import { ConfirmationDialog } from '@/components/ui/confirmation-dialog';
import { createClient } from '@/lib/auth/client';
import type { LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils/cn';

/** Shared header for every account sub-page: back chevron, title, one-line description, optional action. */
export function AccountPageHeader({
  title,
  description,
  onBack,
  action,
}: {
  title: string;
  description?: string;
  onBack?: () => void;
  action?: React.ReactNode;
}) {
  const backClass =
    'inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-line bg-raised text-ink transition-colors hover:bg-subtle focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary';
  return (
    <header className="flex items-start gap-3">
      {onBack ? (
        <button type="button" onClick={onBack} className={backClass} aria-label="Back to account">
          <ChevronLeft className="h-5 w-5" aria-hidden />
        </button>
      ) : (
        <Link href="/account" className={backClass} aria-label="Back to account">
          <ChevronLeft className="h-5 w-5" aria-hidden />
        </Link>
      )}
      <div className="min-w-0 flex-1 pt-0.5">
        <h1 className="font-heading text-2xl font-bold tracking-tight text-ink sm:text-[1.75rem]">{title}</h1>
        {description && <p className="mt-1 text-sm leading-relaxed text-ink-muted">{description}</p>}
      </div>
      {action && <div className="shrink-0 pt-1">{action}</div>}
    </header>
  );
}

/** A titled group of rows inside one rounded surface, separated by hairlines. */
export function SettingsGroup({
  title,
  children,
  className,
}: {
  title?: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section className={className}>
      {title && (
        <h2 className="mb-2 px-1 text-xs font-semibold uppercase tracking-[0.08em] text-ink-muted">{title}</h2>
      )}
      <div className="divide-y divide-line overflow-hidden rounded-2xl border border-line bg-raised">{children}</div>
    </section>
  );
}

interface SettingsRowProps {
  icon: LucideIcon;
  label: string;
  description?: string;
  /** Small trailing text or badge, e.g. a count. */
  trailing?: React.ReactNode;
  href?: string;
  onClick?: () => void;
  tone?: 'default' | 'danger';
}

/** One tappable row: icon, label, hint, trailing value, chevron. At least 56px tall for thumbs. */
export function SettingsRow({ icon: Icon, label, description, trailing, href, onClick, tone = 'default' }: SettingsRowProps) {
  const body = (
    <>
      <span
        className={cn(
          'flex h-10 w-10 shrink-0 items-center justify-center rounded-xl',
          tone === 'danger' ? 'bg-red-50 text-red-600 dark:bg-red-950/40 dark:text-red-400' : 'bg-subtle text-ink',
        )}
      >
        <Icon className="h-[18px] w-[18px]" aria-hidden />
      </span>
      <span className="min-w-0 flex-1">
        <span className={cn('block text-[15px] font-semibold', tone === 'danger' ? 'text-red-600 dark:text-red-400' : 'text-ink')}>
          {label}
        </span>
        {description && <span className="block truncate text-[13px] text-ink-muted">{description}</span>}
      </span>
      {trailing && <span className="shrink-0 text-sm text-ink-muted">{trailing}</span>}
      {tone !== 'danger' && (
        <ChevronRight
          className="h-4 w-4 shrink-0 text-ink-muted transition-transform group-hover:translate-x-0.5 motion-reduce:transition-none"
          aria-hidden
        />
      )}
    </>
  );
  const rowClass =
    'group flex min-h-14 w-full items-center gap-3.5 px-4 py-3 text-left transition-colors hover:bg-subtle/70 focus-visible:bg-subtle focus-visible:outline-none';

  if (href) {
    return (
      <Link href={href} className={rowClass}>
        {body}
      </Link>
    );
  }
  return (
    <button type="button" onClick={onClick} className={rowClass}>
      {body}
    </button>
  );
}

/** Pill used for counts in rows and tiles. */
export function CountPill({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-flex min-w-6 items-center justify-center rounded-full bg-subtle px-2 py-0.5 text-xs font-semibold tabular-nums text-ink">
      {children}
    </span>
  );
}

/** Log out row with a confirmation step, so a stray tap never signs someone out. */
export function SignOutRow() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [signingOut, setSigningOut] = useState(false);

  const handleConfirm = async () => {
    setSigningOut(true);
    await createClient().auth.signOut({ scope: 'local' });
    toast.success('Signed out');
    router.push('/');
    router.refresh();
  };

  return (
    <>
      <SettingsRow icon={LogOut} label="Log out" tone="danger" onClick={() => setOpen(true)} />
      <ConfirmationDialog
        isOpen={open}
        onClose={() => setOpen(false)}
        onConfirm={handleConfirm}
        isConfirming={signingOut}
        variant="danger"
        title="Log out of Rumia?"
        description="You'll need to sign in again to see your wishlist and tour bookings on this device."
        confirmText="Log out"
      />
    </>
  );
}
