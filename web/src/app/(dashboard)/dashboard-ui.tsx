import Link from 'next/link';
import { ArrowUpRight, ChevronLeft } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils/cn';

/** Page title block shared by every dashboard screen: optional eyebrow, title, one-line description, actions. */
export function DashboardPageHeader({
  eyebrow,
  title,
  description,
  actions,
  badge,
  back,
}: {
  /** Parent screen for create/edit pages; top-level sections rely on the sidebar instead. */
  back?: { href: string; label: string };
  eyebrow?: string;
  title: string;
  description?: React.ReactNode;
  actions?: React.ReactNode;
  badge?: React.ReactNode;
}) {
  return (
    <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div className="min-w-0">
        {back && (
          <Link
            href={back.href}
            className="-ml-1 mb-2 inline-flex min-h-9 items-center gap-0.5 rounded-md pr-2 text-sm font-medium text-ink-muted transition-colors hover:text-ink"
          >
            <ChevronLeft className="h-4 w-4" aria-hidden />
            {back.label}
          </Link>
        )}
        {eyebrow && <p className="text-xs font-semibold uppercase tracking-[0.1em] text-ink-muted">{eyebrow}</p>}
        <div className="mt-1 flex flex-wrap items-center gap-2">
          <h1 className="font-heading text-2xl font-bold tracking-tight text-ink sm:text-[1.875rem]">{title}</h1>
          {badge}
        </div>
        {description && <p className="mt-1.5 max-w-2xl text-sm leading-relaxed text-ink-muted">{description}</p>}
      </div>
      {actions && <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div>}
    </header>
  );
}

export const primaryButton =
  'inline-flex h-10 items-center justify-center gap-2 rounded-xl bg-ink px-4 text-sm font-semibold text-page shadow-sm transition-opacity hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2';

export const secondaryButton =
  'inline-flex h-10 items-center justify-center gap-2 rounded-xl border border-line bg-raised px-4 text-sm font-semibold text-ink transition-colors hover:bg-subtle focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary';

/** One headline number. Links through to the screen that explains it. */
export function StatCard({
  label,
  value,
  hint,
  icon: Icon,
  href,
  tone = 'default',
}: {
  label: string;
  value: React.ReactNode;
  hint?: string;
  icon: LucideIcon;
  href: string;
  tone?: 'default' | 'attention';
}) {
  return (
    <Link
      href={href}
      className="group relative flex flex-col justify-between rounded-2xl border border-line bg-raised p-4 transition-shadow hover:shadow-[0_8px_24px_-12px_hsl(var(--ink)/0.25)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary sm:p-5"
    >
      <span className="flex items-center justify-between gap-2">
        <span className="text-[13px] font-medium text-ink-muted">{label}</span>
        <span
          className={cn(
            'flex h-8 w-8 items-center justify-center rounded-lg',
            tone === 'attention' ? 'bg-amber-50 text-amber-700' : 'bg-subtle text-ink-muted group-hover:text-primary',
          )}
        >
          <Icon className="h-4 w-4" aria-hidden />
        </span>
      </span>
      <span className="mt-4 block font-heading text-2xl font-bold tabular-nums tracking-tight text-ink sm:text-[1.75rem]">
        {value}
      </span>
      {hint && <span className="mt-1 block truncate text-xs text-ink-muted">{hint}</span>}
      <ArrowUpRight
        className="absolute bottom-4 right-4 h-4 w-4 text-ink-muted opacity-0 transition-opacity group-hover:opacity-100 motion-reduce:transition-none sm:bottom-5 sm:right-5"
        aria-hidden
      />
    </Link>
  );
}

/** Titled surface for a block of content on a dashboard screen. */
export function Panel({
  title,
  description,
  action,
  children,
  className,
}: {
  title?: string;
  description?: string;
  action?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section className={cn('rounded-2xl border border-line bg-raised', className)}>
      {(title || action) && (
        <div className="flex items-start justify-between gap-3 border-b border-line px-4 py-3.5 sm:px-5">
          <div className="min-w-0">
            {title && <h2 className="text-[15px] font-semibold text-ink">{title}</h2>}
            {description && <p className="mt-0.5 text-[13px] text-ink-muted">{description}</p>}
          </div>
          {action}
        </div>
      )}
      {children}
    </section>
  );
}
