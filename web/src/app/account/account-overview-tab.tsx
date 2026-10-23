'use client';

import Link from 'next/link';
import Image from 'next/image';
import {
  ArrowRight,
  Bell,
  Building2,
  CalendarCheck,
  CalendarClock,
  Clock,
  FileText,
  GraduationCap,
  Heart,
  LayoutDashboard,
  Lock,
  MessageSquare,
  Moon,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
  Sun,
  Sunset,
  UserRound,
} from 'lucide-react';
import type { AccountTab } from './account-tabs';
import { TourCountdown } from '@/components/tour-countdown';
import { UserAvatar } from '@/components/ui/user-avatar';
import type { PlatformInsightData } from '@/lib/utils/insight-engine';
import type { RecentlyViewedHostel } from '@/lib/utils/recently-viewed';
import { CountPill, SettingsGroup, SettingsRow, SignOutRow } from './account-ui';

export interface OverviewUpcomingTour {
  id: string;
  preferred_date: string;
  preferred_time: string;
  status: string;
  amount: number;
  listing?: {
    id: string;
    title: string;
    area: string | null;
  } | null;
}

export interface OverviewSavedItem {
  id: string;
  listing_id: string;
  listings: {
    id: string;
    title: string;
    price: number;
    location: string;
    slug: string | null;
    county: string | null;
    area: string | null;
    listing_images?: { r2_url: string; display_order: number }[];
  } | null;
}

interface AccountOverviewTabProps {
  displayName: string;
  email?: string;
  avatarUrl?: string | null;
  savedCount: number;
  activeToursCount: number;
  upcomingTour: OverviewUpcomingTour | null;
  savedPreview: OverviewSavedItem[];
  /** Kept for the page's data loading; the overview no longer renders a generated greeting. */
  recentlyViewed?: RecentlyViewedHostel[];
  platformData?: PlatformInsightData;
  onTabChange: (tab: AccountTab, hash?: string) => void;
  hasAgent?: boolean;
  isManager?: boolean;
  isAdmin?: boolean;
  hasPendingAgentApplication?: boolean;
  studentPhone?: string | null;
  studentCampusId?: string | null;
  studentCampusName?: string | null;
}

const TIME_LABELS: Record<string, { label: string; icon: typeof Sun }> = {
  morning: { label: 'Morning', icon: Sun },
  afternoon: { label: 'Afternoon', icon: Sunset },
  evening: { label: 'Evening', icon: Moon },
};

function formatTourDate(value: string): string {
  const date = new Date(`${value}T00:00:00`);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString('en-KE', { weekday: 'short', day: 'numeric', month: 'short' });
}

function firstImage(item: OverviewSavedItem): string | null {
  const images = [...(item.listings?.listing_images ?? [])].sort((a, b) => a.display_order - b.display_order);
  return images[0]?.r2_url ?? null;
}

/** Up to three overlapping wishlist photos, the way a group of saved places reads at a glance. */
function SavedThumbStack({ items }: { items: OverviewSavedItem[] }) {
  const photos = items.map(firstImage).filter((src): src is string => !!src).slice(0, 3);
  if (photos.length === 0) return null;
  return (
    <span className="flex -space-x-2.5" aria-hidden>
      {photos.map((src, i) => (
        <span key={src + i} className="relative h-8 w-8 overflow-hidden rounded-lg border-2 border-raised bg-subtle">
          <Image src={src} alt="" fill sizes="32px" className="object-cover" />
        </span>
      ))}
    </span>
  );
}

function ProfileCard({
  displayName,
  email,
  avatarUrl,
  campusName,
  activeToursCount,
  savedCount,
  onTabChange,
}: {
  displayName: string;
  email?: string;
  avatarUrl?: string | null;
  campusName: string | null;
  activeToursCount: number;
  savedCount: number;
  onTabChange: (tab: AccountTab) => void;
}) {
  const stats = [
    { label: activeToursCount === 1 ? 'Active tour' : 'Active tours', value: activeToursCount, tab: 'tours' as const },
    { label: 'Saved', value: savedCount, tab: 'saved' as const },
  ];

  return (
    <div className="overflow-hidden rounded-3xl border border-line bg-raised shadow-[0_10px_30px_-18px_hsl(var(--ink)/0.35)]">
      <div className="flex items-center gap-4 p-5 lg:flex-col lg:p-6 lg:text-center">
        <UserAvatar
          name={displayName}
          imageUrl={avatarUrl}
          size="lg"
          className="ring-4 ring-primary/10 lg:h-24 lg:w-24 lg:text-2xl"
        />
        <div className="min-w-0 flex-1">
          <p className="truncate font-heading text-xl font-bold tracking-tight text-ink lg:text-2xl">{displayName}</p>
          {email && <p className="truncate text-sm text-ink-muted">{email}</p>}
          {campusName && (
            <p className="mt-1.5 inline-flex max-w-full items-center gap-1.5 rounded-full bg-primary/10 px-2.5 py-1 text-xs font-semibold text-primary">
              <GraduationCap className="h-3.5 w-3.5 shrink-0" aria-hidden />
              <span className="truncate">{campusName}</span>
            </p>
          )}
        </div>
      </div>

      <div className="grid grid-cols-2 divide-x divide-line border-t border-line">
        {stats.map((stat) => (
          <button
            key={stat.tab}
            type="button"
            onClick={() => onTabChange(stat.tab)}
            className="flex min-h-16 flex-col items-center justify-center px-3 py-3 transition-colors hover:bg-subtle/70 focus-visible:bg-subtle focus-visible:outline-none"
          >
            <span className="font-heading text-xl font-bold tabular-nums text-ink">{stat.value}</span>
            <span className="text-xs font-medium text-ink-muted">{stat.label}</span>
          </button>
        ))}
      </div>

      <div className="border-t border-line p-3">
        <button
          type="button"
          onClick={() => onTabChange('settings')}
          className="flex h-11 w-full items-center justify-center rounded-xl border border-line text-sm font-semibold text-ink transition-colors hover:bg-subtle focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
        >
          Edit profile
        </button>
      </div>
    </div>
  );
}

function NextTourCard({ tour, onOpen }: { tour: OverviewUpcomingTour; onOpen: () => void }) {
  const time = TIME_LABELS[tour.preferred_time];
  const TimeIcon = time?.icon ?? Clock;
  return (
    <button
      type="button"
      onClick={onOpen}
      className="group relative w-full overflow-hidden rounded-3xl border border-primary/20 bg-gradient-to-br from-primary/[0.09] via-primary/[0.04] to-transparent p-5 text-left transition-shadow hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary sm:p-6"
    >
      <span className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.08em] text-primary">
        <CalendarClock className="h-4 w-4" aria-hidden />
        Your next viewing
      </span>
      <span className="mt-2 block font-heading text-xl font-bold leading-snug tracking-tight text-ink sm:text-2xl">
        {tour.listing?.title || 'Guided tour'}
      </span>
      <span className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-ink-muted">
        <span className="inline-flex items-center gap-1.5">
          <CalendarCheck className="h-4 w-4" aria-hidden />
          {formatTourDate(tour.preferred_date)}
        </span>
        {time && (
          <span className="inline-flex items-center gap-1.5">
            <TimeIcon className="h-4 w-4" aria-hidden />
            {time.label}
          </span>
        )}
        {tour.listing?.area && <span>{tour.listing.area}</span>}
      </span>
      <span className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-primary/15 pt-4">
        <span className="text-sm font-medium text-ink">
          <TourCountdown
            preferredDate={tour.preferred_date}
            preferredTime={tour.preferred_time as 'morning' | 'afternoon' | 'evening'}
            compact
          />
        </span>
        <span className="inline-flex items-center gap-1.5 text-sm font-semibold text-primary">
          Tour details
          <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5 motion-reduce:transition-none" aria-hidden />
        </span>
      </span>
    </button>
  );
}

function FindAHostelCard({ onOpen }: { onOpen: () => void }) {
  return (
    <button
      type="button"
      onClick={onOpen}
      className="group flex w-full items-center gap-4 rounded-3xl border border-line bg-raised p-5 text-left transition-shadow hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
    >
      <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-primary text-primary-foreground">
        <Sparkles className="h-6 w-6" aria-hidden />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-base font-bold text-ink">Find me a hostel</span>
        <span className="block text-sm leading-snug text-ink-muted">
          Tell us your budget and area. A Rumia manager finds options and contacts you on WhatsApp.
        </span>
      </span>
      <ArrowRight
        className="h-5 w-5 shrink-0 text-ink-muted transition-transform group-hover:translate-x-0.5 group-hover:text-primary motion-reduce:transition-none"
        aria-hidden
      />
    </button>
  );
}

function AgentPromo({ pending, onApply }: { pending: boolean; onApply: () => void }) {
  if (pending) {
    return (
      <div className="flex items-start gap-3.5 rounded-3xl border border-line bg-raised p-5">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-400">
          <Clock className="h-5 w-5" aria-hidden />
        </span>
        <span>
          <span className="block text-[15px] font-semibold text-ink">Agent application under review</span>
          <span className="block text-sm text-ink-muted">We&apos;ll let you know as soon as it&apos;s decided.</span>
        </span>
      </div>
    );
  }
  return (
    <button
      type="button"
      onClick={onApply}
      className="group flex w-full items-center gap-4 rounded-3xl border border-line bg-subtle/60 p-5 text-left transition-colors hover:bg-subtle focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
    >
      <span className="min-w-0 flex-1">
        <span className="block text-base font-bold text-ink">List your property on Rumia</span>
        <span className="block text-sm leading-snug text-ink-muted">
          Become an agent and get enquiries from students looking for a place.
        </span>
        <span className="mt-2 inline-flex items-center gap-1 text-sm font-semibold text-primary">
          Apply to be an agent
          <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5 motion-reduce:transition-none" aria-hidden />
        </span>
      </span>
      <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-raised text-ink shadow-sm">
        <Building2 className="h-7 w-7" aria-hidden />
      </span>
    </button>
  );
}

export function AccountOverviewTab({
  displayName,
  email,
  avatarUrl = null,
  savedCount,
  activeToursCount,
  upcomingTour,
  savedPreview,
  onTabChange,
  hasAgent = false,
  isManager = false,
  isAdmin = false,
  hasPendingAgentApplication = false,
  studentCampusName = null,
}: AccountOverviewTabProps) {
  const showWorkspaces = hasAgent || isManager || isAdmin;

  return (
    <div className="lg:grid lg:grid-cols-[300px_minmax(0,1fr)] lg:items-start lg:gap-10">
      <h1 className="mb-5 font-heading text-[1.75rem] font-bold tracking-tight text-ink lg:col-span-2 lg:mb-2 lg:text-3xl">
        Account
      </h1>

      <aside className="lg:sticky lg:top-[calc(var(--shell-header-h)+1.5rem)]">
        <ProfileCard
          displayName={displayName}
          email={email}
          avatarUrl={avatarUrl}
          campusName={studentCampusName}
          activeToursCount={activeToursCount}
          savedCount={savedCount}
          onTabChange={onTabChange}
        />
      </aside>

      <div className="mt-6 space-y-8 lg:mt-0">
        {upcomingTour ? (
          <NextTourCard tour={upcomingTour} onOpen={() => onTabChange('tours')} />
        ) : null}

        <FindAHostelCard onOpen={() => onTabChange('find-a-hostel')} />

        <SettingsGroup title="Your activity">
          <SettingsRow
            icon={CalendarCheck}
            label="Tours & viewings"
            description={
              upcomingTour
                ? `Next: ${upcomingTour.listing?.title || 'Guided tour'}`
                : 'Upcoming, completed and cancelled tours'
            }
            trailing={activeToursCount > 0 ? <CountPill>{activeToursCount}</CountPill> : undefined}
            onClick={() => onTabChange('tours')}
          />
          <SettingsRow
            icon={Heart}
            label="Wishlist & compare"
            description={savedCount > 0 ? 'Compare prices and amenities side by side' : 'Save places you like as you browse'}
            trailing={
              savedCount > 0 ? (
                <span className="flex items-center gap-2">
                  <SavedThumbStack items={savedPreview} />
                  <CountPill>{savedCount}</CountPill>
                </span>
              ) : undefined
            }
            onClick={() => onTabChange('saved')}
          />
        </SettingsGroup>

        <SettingsGroup title="Account">
          <SettingsRow
            icon={UserRound}
            label="Personal info"
            description="Name, phone number and campus"
            onClick={() => onTabChange('settings')}
          />
          <SettingsRow
            icon={Bell}
            label="Notifications"
            description="Tour updates and wishlist price drops"
            onClick={() => onTabChange('settings', 'notifications')}
          />
        </SettingsGroup>

        {showWorkspaces && (
          <SettingsGroup title="Workspaces">
            {hasAgent && (
              <SettingsRow icon={LayoutDashboard} label="Agent dashboard" description="Listings, leads and tours" href="/dashboard" />
            )}
            {isManager && (
              <SettingsRow icon={ShieldCheck} label="Manager" description="Campus operations, agents and requests" href="/manager" />
            )}
            {isAdmin && <SettingsRow icon={ShieldAlert} label="Admin" description="Platform administration" href="/admin" />}
          </SettingsGroup>
        )}

        {!hasAgent && (
          <AgentPromo pending={hasPendingAgentApplication} onApply={() => onTabChange('agent-application')} />
        )}

        <SettingsGroup title="Support">
          <SettingsRow
            icon={ShieldCheck}
            label="Verify an agent or hostel"
            description="Check before you pay, or report a problem"
            href="/verify"
          />
          <SettingsRow
            icon={MessageSquare}
            label="Share feedback"
            description="Report a problem or suggest an improvement"
            onClick={() => onTabChange('feedback')}
          />
        </SettingsGroup>

        <SettingsGroup title="Legal">
          <SettingsRow icon={Lock} label="Privacy policy" href="/policy" />
          <SettingsRow icon={FileText} label="Terms of service" href="/terms" />
        </SettingsGroup>

        <SettingsGroup>
          <SignOutRow />
        </SettingsGroup>
      </div>
    </div>
  );
}
