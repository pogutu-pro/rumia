import { TodayPanel } from '@/components/dashboard/today-panel';
import { createClient } from '@/lib/auth/server';
import { redirect } from 'next/navigation';
import Image from 'next/image';
import Link from 'next/link';
import {
  AlertCircle,
  ArrowRight,
  Bed,
  Building2,
  CalendarCheck,
  CreditCard,
  MessageCircle,
  Moon,
  Plus,
  Sun,
  Sunset,
  Wallet,
} from 'lucide-react';
import { SuspensionBanner } from './suspension-banner';
import { agentDashboardApi, type AgentListing, type StaffTour } from '@/lib/api/agent-dashboard';
import { DashboardPageHeader, Panel, StatCard, primaryButton, secondaryButton } from '../dashboard-ui';

export const revalidate = 0;

// Listers are in Kenya; the server is not, so greet and date in Nairobi time.
const TIME_ZONE = 'Africa/Nairobi';

function getGreeting(now: Date): string {
  const hour = Number(new Intl.DateTimeFormat('en-GB', { hour: 'numeric', hour12: false, timeZone: TIME_ZONE }).format(now));
  if (hour < 12) return 'Good morning';
  if (hour < 17) return 'Good afternoon';
  return 'Good evening';
}

const TIME_ICONS = { morning: Sun, afternoon: Sunset, evening: Moon } as const;
const CLOSED_TOUR_STATUSES = new Set(['completed', 'cancelled', 'no_show']);

function formatTourDate(value: string): string {
  const date = new Date(`${value}T00:00:00`);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString('en-KE', { weekday: 'short', day: 'numeric', month: 'short' });
}

function UpcomingTours({ tours }: { tours: StaffTour[] }) {
  return (
    <Panel
      title="Upcoming tours"
      description="Students who booked a viewing"
      action={
        <Link href="/dashboard/tours" className="text-sm font-semibold text-primary hover:underline">
          View all
        </Link>
      }
    >
      {tours.length === 0 ? (
        <div className="px-5 py-10 text-center">
          <CalendarCheck className="mx-auto h-6 w-6 text-ink-muted" aria-hidden />
          <p className="mt-2 text-sm font-semibold text-ink">No tours booked yet</p>
          <p className="mt-0.5 text-[13px] text-ink-muted">New bookings will show up here.</p>
        </div>
      ) : (
        <ul className="divide-y divide-line">
          {tours.map((tour) => {
            const TimeIcon = TIME_ICONS[tour.preferred_time as keyof typeof TIME_ICONS] ?? Sun;
            return (
              <li key={tour.id} className="flex items-center gap-3 px-4 py-3 sm:px-5">
                <span className="flex h-10 w-10 shrink-0 flex-col items-center justify-center rounded-xl bg-subtle text-ink">
                  <TimeIcon className="h-4 w-4" aria-hidden />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-ink">{tour.student_name || 'Student'}</p>
                  <p className="truncate text-[13px] text-ink-muted">
                    {tour.listing?.title || 'Guided tour'}
                    {tour.listing?.area ? ` · ${tour.listing.area}` : ''}
                  </p>
                </div>
                <div className="shrink-0 text-right">
                  <p className="text-sm font-semibold text-ink">{formatTourDate(tour.preferred_date)}</p>
                  <p className="text-xs capitalize text-ink-muted">{tour.status.replace(/_/g, ' ')}</p>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </Panel>
  );
}

function TopListings({ listings }: { listings: AgentListing[] }) {
  return (
    <Panel
      title="Your listings"
      description="Ranked by student enquiries"
      action={
        <Link href="/dashboard/listings" className="text-sm font-semibold text-primary hover:underline">
          Manage
        </Link>
      }
    >
      {listings.length === 0 ? (
        <div className="px-5 py-10 text-center">
          <Building2 className="mx-auto h-6 w-6 text-ink-muted" aria-hidden />
          <p className="mt-2 text-sm font-semibold text-ink">No listings yet</p>
          <p className="mt-0.5 text-[13px] text-ink-muted">Add your first property to start getting enquiries.</p>
          <Link href="/dashboard/new" className={`${primaryButton} mt-4`}>
            <Plus className="h-4 w-4" aria-hidden />
            New listing
          </Link>
        </div>
      ) : (
        <ul className="divide-y divide-line">
          {listings.map((listing) => {
            const image = [...listing.images].sort((a, b) => a.display_order - b.display_order)[0];
            return (
              <li key={listing.id}>
                <Link
                  href="/dashboard/listings"
                  className="flex items-center gap-3 px-4 py-3 transition-colors hover:bg-subtle/60 sm:px-5"
                >
                  <span className="relative h-11 w-11 shrink-0 overflow-hidden rounded-xl bg-subtle">
                    {image ? (
                      <Image src={image.r2_url} alt="" fill sizes="44px" className="object-cover" />
                    ) : (
                      <Building2 className="absolute inset-0 m-auto h-4 w-4 text-ink-muted" aria-hidden />
                    )}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-semibold text-ink">{listing.title}</span>
                    <span className="block truncate text-[13px] text-ink-muted">
                      {listing.area || listing.location}
                    </span>
                  </span>
                  <span className="shrink-0 text-right">
                    <span className="block text-sm font-semibold tabular-nums text-ink">{listing.lead_count}</span>
                    <span className="block text-xs text-ink-muted">{listing.lead_count === 1 ? 'lead' : 'leads'}</span>
                  </span>
                  <span
                    className={`h-2 w-2 shrink-0 rounded-full ${listing.is_active && !listing.is_full ? 'bg-primary' : 'bg-ink-muted/40'}`}
                    title={listing.is_full ? 'Full' : listing.is_active ? 'Live' : 'Hidden'}
                    aria-label={listing.is_full ? 'Full' : listing.is_active ? 'Live' : 'Hidden'}
                  />
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </Panel>
  );
}

export default async function DashboardPage() {
  const authClient = await createClient();

  const {
    data: { user },
  } = await authClient.auth.getUser();
  if (!user) {
    redirect('/auth/login');
  }

  // Admins/managers get an agent record on first visit; everyone else is sent to apply.
  let summary = null;
  try {
    if (!(await agentDashboardApi.getSelf())) {
      await agentDashboardApi.ensure();
    }
    summary = await agentDashboardApi.summary();
  } catch (error) {
    console.error('Failed to load the agent dashboard:', error);
  }

  if (!summary) {
    return (
      <div className="mx-auto mt-12 max-w-md rounded-2xl border border-line bg-raised p-8 text-center">
        <span className="mx-auto flex h-11 w-11 items-center justify-center rounded-full bg-rose-50 text-rose-600">
          <AlertCircle className="h-5 w-5" aria-hidden />
        </span>
        <h1 className="mt-4 font-heading text-xl font-bold text-ink">We couldn&apos;t open your dashboard</h1>
        <p className="mt-2 text-sm text-ink-muted">
          No agent profile could be found or created for this account. Please contact the Rumia team.
        </p>
      </div>
    );
  }

  const agent = summary.agent;

  if (agent.status === 'suspended') {
    return (
      <div className="space-y-6">
        <SuspensionBanner
          agentName={agent.name}
          suspensionReason={agent.suspension_reason || 'No reason provided.'}
        />
      </div>
    );
  }

  // Secondary panels: never block the page on them.
  const [toursRes, listingsRes] = await Promise.all([
    agentDashboardApi.tours('upcoming').catch(() => null),
    agentDashboardApi.listings().catch(() => null),
  ]);
  const upcomingTours = (toursRes?.items ?? []).filter((t) => !CLOSED_TOUR_STATUSES.has(t.status)).slice(0, 4);
  const topListings = [...(listingsRes ?? [])].sort((a, b) => b.lead_count - a.lead_count).slice(0, 4);

  const now = new Date();
  const firstName = (agent.name || 'Agent').split(' ')[0];
  const today = new Intl.DateTimeFormat('en-KE', { weekday: 'long', day: 'numeric', month: 'long', timeZone: TIME_ZONE }).format(now);
  const activeCount = summary.active_listing_count;
  const pendingTours = summary.pending_tours || 0;

  return (
    <div className="space-y-8">
      <DashboardPageHeader
        eyebrow={today}
        title={`${getGreeting(now)}, ${firstName}`}
        description={
          activeCount > 0
            ? `${activeCount} active listing${activeCount !== 1 ? 's' : ''} bringing in student enquiries.`
            : 'Create your first listing to start receiving student enquiries.'
        }
        actions={
          <>
            <Link href="/dashboard/bnb/new" className={secondaryButton}>
              <Bed className="h-4 w-4" aria-hidden />
              <span>Short stay</span>
            </Link>
            <Link href="/dashboard/new" className={primaryButton}>
              <Plus className="h-4 w-4" aria-hidden />
              New listing
            </Link>
          </>
        }
      />

      {!summary.has_payment_details && (
        <Link
          href="/dashboard/payment"
          className="group flex items-center gap-3 rounded-2xl border border-amber-200 bg-amber-50/70 px-4 py-3.5 transition-colors hover:bg-amber-50"
        >
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-amber-100 text-amber-700">
            <CreditCard className="h-4 w-4" aria-hidden />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-sm font-semibold text-amber-950">Add your payment details</span>
            <span className="block text-[13px] leading-snug text-amber-900/80">
              Add your Pochi la Biashara number so students can pay your consultation fee directly.
            </span>
          </span>
          <ArrowRight className="h-4 w-4 shrink-0 text-amber-800 transition-transform group-hover:translate-x-0.5" aria-hidden />
        </Link>
      )}

      <TodayPanel />

      <section aria-label="Key numbers" className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        <StatCard
          label="Active listings"
          value={activeCount}
          hint={`${summary.listing_count} in total`}
          icon={Building2}
          href="/dashboard/listings"
        />
        <StatCard
          label="Leads this month"
          value={summary.leads_this_month || 0}
          hint={`${summary.total_leads || 0} all time`}
          icon={MessageCircle}
          href="/dashboard/leads"
        />
        <StatCard
          label="Pending tours"
          value={pendingTours}
          hint={pendingTours > 0 ? 'Waiting for you' : 'All caught up'}
          icon={CalendarCheck}
          href="/dashboard/tours"
          tone={pendingTours > 0 ? 'attention' : 'default'}
        />
        <StatCard
          label="Tour earnings"
          value={`KES ${summary.tour_earnings.toLocaleString()}`}
          hint="Completed and paid tours"
          icon={Wallet}
          href="/dashboard/earnings"
        />
      </section>

      <div className="grid gap-6 lg:grid-cols-2">
        <UpcomingTours tours={upcomingTours} />
        <TopListings listings={topListings} />
      </div>
    </div>
  );
}
