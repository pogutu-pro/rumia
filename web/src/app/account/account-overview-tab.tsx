'use client';

import Link from 'next/link';
import Image from 'next/image';
import {
  ArrowRight,
  Building2,
  CalendarCheck,
  Clock,
  GitCompareArrows,
  Heart,
  LayoutDashboard,
  MessageSquare,
  Settings,
  ShieldAlert,
  ShieldCheck,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import type { AccountTab } from './account-tabs';
import { TourCountdown } from '@/components/tour-countdown';
import type { PlatformInsightData } from '@/lib/utils/insight-engine';
import type { RecentlyViewedHostel } from '@/lib/utils/recently-viewed';
import { FindMeAHostel } from './find-me-a-hostel';

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
  savedCount: number;
  activeToursCount: number;
  upcomingTour: OverviewUpcomingTour | null;
  savedPreview: OverviewSavedItem[];
  /** Kept for the page's data loading; the overview no longer renders a generated greeting. */
  recentlyViewed?: RecentlyViewedHostel[];
  platformData?: PlatformInsightData;
  onTabChange: (tab: AccountTab) => void;
  hasAgent?: boolean;
  isManager?: boolean;
  isAdmin?: boolean;
  hasPendingAgentApplication?: boolean;
  studentPhone?: string | null;
  studentCampusId?: string | null;
  studentCampusName?: string | null;
}

const cardBase =
  'group flex flex-col justify-between rounded-2xl border border-line bg-raised p-4 text-left transition-shadow hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2';

function SectionHeading({ id, title, hint }: { id: string; title: string; hint?: string }) {
  return (
    <div className="mb-3">
      <h2 id={id} className="font-heading text-lg font-bold tracking-tight text-ink">
        {title}
      </h2>
      {hint && <p className="text-sm text-ink-muted">{hint}</p>}
    </div>
  );
}

function CardAction({ label }: { label: string }) {
  return (
    <span className="mt-4 flex items-center justify-between border-t border-line pt-3 text-sm font-semibold text-ink group-hover:text-primary">
      {label}
      <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5 motion-reduce:transition-none" aria-hidden />
    </span>
  );
}

function IconBadge({ icon: Icon }: { icon: LucideIcon }) {
  return (
    <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
      <Icon className="h-5 w-5" aria-hidden />
    </span>
  );
}

function WorkspaceLink({ href, icon: Icon, title, text }: { href: string; icon: LucideIcon; title: string; text: string }) {
  return (
    <Link href={href} className={cardBase}>
      <span className="flex items-start gap-3">
        <IconBadge icon={Icon} />
        <span>
          <span className="block text-base font-semibold text-ink">{title}</span>
          <span className="block text-sm text-ink-muted">{text}</span>
        </span>
      </span>
      <CardAction label={`Open ${title.toLowerCase()}`} />
    </Link>
  );
}

export function AccountOverviewTab({
  displayName,
  email,
  savedCount,
  activeToursCount,
  upcomingTour,
  savedPreview,
  onTabChange,
  hasAgent = false,
  isManager = false,
  isAdmin = false,
  hasPendingAgentApplication = false,
  studentPhone = null,
  studentCampusId = null,
  studentCampusName = null,
}: AccountOverviewTabProps) {
  const summary = [
    activeToursCount > 0 ? `${activeToursCount} active ${activeToursCount === 1 ? 'tour' : 'tours'}` : null,
    savedCount > 0 ? `${savedCount} saved ${savedCount === 1 ? 'place' : 'places'}` : null,
  ].filter(Boolean);

  const showWorkspaces = hasAgent || isManager || isAdmin;

  return (
    <div className="space-y-10">
      {/* Overview */}
      <header>
        <h1 className="font-heading text-2xl font-bold tracking-tight text-ink">Your account</h1>
        <p className="mt-1 text-sm text-ink-muted">
          {displayName}
          {email ? ` · ${email}` : ''}
          {summary.length > 0 ? ` · ${summary.join(' · ')}` : ''}
        </p>
      </header>

      {/* Your activity */}
      <section aria-labelledby="activity-heading">
        <SectionHeading id="activity-heading" title="Your activity" />
        <div className="grid gap-4 sm:grid-cols-2">
          <button type="button" onClick={() => onTabChange('tours')} className={cardBase}>
            <span>
              <span className="flex items-center justify-between">
                <IconBadge icon={CalendarCheck} />
                <span className="rounded-full bg-subtle px-2.5 py-1 text-xs font-semibold tabular-nums text-ink">
                  {activeToursCount} active
                </span>
              </span>
              <span className="mt-3 block text-base font-semibold text-ink">Tour bookings & visits</span>
              <span className="block text-sm text-ink-muted">Upcoming, completed and cancelled tours.</span>
              {upcomingTour && (
                <span className="mt-3 block rounded-xl bg-subtle p-3">
                  <span className="block text-xs font-semibold text-primary">Next tour</span>
                  <span className="block truncate text-sm font-semibold text-ink">
                    {upcomingTour.listing?.title || 'Guided tour'}
                  </span>
                  <TourCountdown
                    preferredDate={upcomingTour.preferred_date}
                    preferredTime={upcomingTour.preferred_time as 'morning' | 'afternoon' | 'evening'}
                    compact
                  />
                </span>
              )}
            </span>
            <CardAction label="View tours" />
          </button>

          <button type="button" onClick={() => onTabChange('saved')} className={cardBase}>
            <span>
              <span className="flex items-center justify-between">
                <IconBadge icon={Heart} />
                <span className="rounded-full bg-subtle px-2.5 py-1 text-xs font-semibold tabular-nums text-ink">
                  {savedCount} saved
                </span>
              </span>
              <span className="mt-3 block text-base font-semibold text-ink">Wishlist & compare</span>
              <span className="block text-sm text-ink-muted">Review saved places and compare prices and amenities.</span>
              {savedPreview.length > 0 && (
                <span className="mt-3 flex gap-1.5">
                  {savedPreview.slice(0, 4).map((item) => {
                    const image = [...(item.listings?.listing_images ?? [])].sort(
                      (a, b) => a.display_order - b.display_order,
                    )[0];
                    return (
                      <span key={item.id} className="relative h-11 w-11 shrink-0 overflow-hidden rounded-lg border border-line bg-subtle">
                        {image ? (
                          <Image src={image.r2_url} alt="" fill sizes="44px" className="object-cover" />
                        ) : (
                          <span className="flex h-full w-full items-center justify-center">
                            <Heart className="h-3.5 w-3.5 text-ink-muted" aria-hidden />
                          </span>
                        )}
                      </span>
                    );
                  })}
                </span>
              )}
            </span>
            <CardAction label="Open wishlist" />
          </button>
        </div>
        <p className="mt-3 flex items-center gap-1.5 text-xs text-ink-muted">
          <GitCompareArrows className="h-3.5 w-3.5" aria-hidden />
          Comparison is available from your wishlist.
        </p>
      </section>

      {/* Find Me a Hostel */}
      <section id="find-me-a-hostel">
        <FindMeAHostel
          studentName={displayName}
          studentPhone={studentPhone}
          campusId={studentCampusId}
          campusName={studentCampusName}
        />
      </section>

      {/* Help and settings */}
      <section aria-labelledby="help-heading">
        <SectionHeading id="help-heading" title="Feedback & settings" />
        <div className="grid gap-4 sm:grid-cols-2">
          <button type="button" onClick={() => onTabChange('feedback')} className={cardBase}>
            <span className="flex items-start gap-3">
              <IconBadge icon={MessageSquare} />
              <span>
                <span className="block text-base font-semibold text-ink">Share feedback</span>
                <span className="block text-sm text-ink-muted">Report a problem or suggest an improvement.</span>
              </span>
            </span>
            <CardAction label="Send feedback" />
          </button>
          <button type="button" onClick={() => onTabChange('settings')} className={cardBase}>
            <span className="flex items-start gap-3">
              <IconBadge icon={Settings} />
              <span>
                <span className="block text-base font-semibold text-ink">Account settings</span>
                <span className="block text-sm text-ink-muted">Profile, campus, notifications and sign out.</span>
              </span>
            </span>
            <CardAction label="Edit profile" />
          </button>
        </div>
      </section>

      {/* Role tools: only what this account may use */}
      {(showWorkspaces || !hasAgent) && (
        <section aria-labelledby="workspace-heading">
          <SectionHeading
            id="workspace-heading"
            title={showWorkspaces ? 'Workspaces' : 'List a property'}
            hint={showWorkspaces ? 'Operational tools for your role.' : undefined}
          />
          <div className="grid gap-4 sm:grid-cols-2">
            {hasAgent && (
              <WorkspaceLink href="/dashboard" icon={LayoutDashboard} title="Agent dashboard" text="Manage your listings, leads and tours." />
            )}
            {isManager && (
              <WorkspaceLink href="/manager" icon={ShieldCheck} title="Manager" text="Campus operations, agents and requests." />
            )}
            {isAdmin && (
              <WorkspaceLink href="/admin" icon={ShieldAlert} title="Admin" text="Platform administration." />
            )}
            {!hasAgent &&
              (hasPendingAgentApplication ? (
                <div className="rounded-2xl border border-line bg-raised p-4">
                  <span className="flex items-start gap-3">
                    <IconBadge icon={Clock} />
                    <span>
                      <span className="block text-base font-semibold text-ink">Agent application pending</span>
                      <span className="block text-sm text-ink-muted">
                        Your application is under review. You will be notified once it is decided.
                      </span>
                    </span>
                  </span>
                </div>
              ) : (
                <button type="button" onClick={() => onTabChange('agent-application')} className={cardBase}>
                  <span className="flex items-start gap-3">
                    <IconBadge icon={Building2} />
                    <span>
                      <span className="block text-base font-semibold text-ink">Become a Rumia agent</span>
                      <span className="block text-sm text-ink-muted">
                        Apply to list properties and receive enquiries from people looking for a place.
                      </span>
                    </span>
                  </span>
                  <CardAction label="Apply" />
                </button>
              ))}
          </div>
        </section>
      )}
    </div>
  );
}
