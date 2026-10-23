'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { createClient } from '@/lib/auth/client';
import { campusesApi } from '@/lib/api/campuses';
import { listingsClientApi } from '@/lib/api/listings-client';
import { profilesApi, type UserProfile } from '@/lib/api/profiles';
import { toursApi } from '@/lib/api/tours';
import Link from 'next/link';
import { ArrowRight, UserRoundCheck } from 'lucide-react';
import { missingSetup, WELCOME_PATH } from '@/lib/auth/onboarding';
import { apiClient } from '@/lib/api/client';
import posthog from 'posthog-js';
import type { AccountTab } from './account-tabs';
import {
  AccountOverviewTab,
  type OverviewUpcomingTour,
  type OverviewSavedItem,
} from './account-overview-tab';
import type { PlatformInsightData } from '@/lib/utils/insight-engine';
import { AccountToursTab } from './account-tours-tab';
import { AccountSavedTab } from './account-saved-tab';
import { AccountFeedbackTab } from './account-feedback-tab';
import { AccountSettingsTab } from './account-settings-tab';
import { AccountAgentApplicationTab } from './account-agent-application-tab';
import { AccountPageHeader } from './account-ui';
import { FindMeAHostel, PENDING_REQUEST_KEY } from './find-me-a-hostel';
import { PushNotificationPrompt } from '@/components/pwa/PushNotificationPrompt';
import {
  getRecentlyViewedHostels,
  type RecentlyViewedHostel,
} from '@/lib/utils/recently-viewed';
import type { Campus } from '@/types';
import { getMyAgentApplicationsAction } from '@/app/actions/agent-application';

const VALID_TABS = new Set<AccountTab>([
  'overview',
  'tours',
  'saved',
  'feedback',
  'settings',
  'agent-application',
  'find-a-hostel',
]);

function getValidTab(value: string | null): AccountTab {
  if (value && VALID_TABS.has(value as AccountTab)) return value as AccountTab;
  return 'overview';
}

interface Profile {
  id: string;
  email: string;
  full_name: string | null;
  avatar_url: string | null;
  phone: string | null;
  role: string | null;
  campus_id?: string | null;
  home_campus_id?: string | null;
  home_campus_name?: string | null;
  home_campus_confirmed_at?: string | null;
}

/** One retry for transient failures; null (not an empty object) tells the caller the load failed. */
async function loadProfileWithRetry(): Promise<UserProfile | null> {
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      return await profilesApi.getMe();
    } catch (err) {
      const status = (err as { status?: number })?.status;
      // 401/403/404 will not improve by retrying.
      if (status === 401 || status === 403 || status === 404) return null;
      if (attempt === 0) await new Promise((resolve) => setTimeout(resolve, 800));
    }
  }
  return null;
}

function AccountSkeleton() {
  return (
    <div className="min-h-[calc(100dvh-var(--shell-header-h))]">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <div className="skeleton mb-5 h-8 w-36" />
        <div className="lg:grid lg:grid-cols-[300px_minmax(0,1fr)] lg:gap-10">
          <div className="skeleton h-56 rounded-3xl" />
          <div className="mt-6 space-y-6 lg:mt-0">
            <div className="skeleton h-24 rounded-3xl" />
            <div className="skeleton h-36 rounded-2xl" />
            <div className="skeleton h-36 rounded-2xl" />
          </div>
        </div>
      </div>
      <span className="sr-only" role="status">Loading your account</span>
    </div>
  );
}

export default function AccountPage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const activeTab = getValidTab(searchParams.get('tab'));

  const [profile, setProfile] = useState<Profile | null>(null);
  const [hasAgent, setHasAgent] = useState(false);
  const [hasPendingAgentApplication, setHasPendingAgentApplication] = useState(false);
  const [loading, setLoading] = useState(true);
  const [savedCount, setSavedCount] = useState(0);
  const [activeToursCount, setActiveToursCount] = useState(0);
  const [upcomingTour, setUpcomingTour] = useState<OverviewUpcomingTour | null>(
    null,
  );
  const [savedPreview, setSavedPreview] = useState<OverviewSavedItem[]>([]);
  const [recentlyViewed, setRecentlyViewed] = useState<RecentlyViewedHostel[]>(
    [],
  );
  const [platformData, setPlatformData] = useState<
    PlatformInsightData | undefined
  >(undefined);
  const [campuses, setCampuses] = useState<Campus[]>([]);
  // True when /profiles/me could not be read. We must not guess "profile incomplete" from an
  // empty fallback: that asked users who had already finished to set up again.
  const [profileLoadFailed, setProfileLoadFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;

    // Phase 1 (critical path): only what the shell needs to paint — auth,
    // profile, tours and saved counts. Everything else is deferred to
    // loadDeferred() so the header/tabs render before the heavier queries
    // resolve, making the page feel near-instant.
    async function loadCritical() {
      const authClient = createClient();
      // Hydrate the client's in-memory session from cookies before calling
      // getUser(). The singleton browser client may have been instantiated
      // before the OAuth callback set the session cookies, so its in-memory
      // state is empty and getUser() would return null without this call.
      await authClient.auth.getSession();
      const {
        data: { user },
      } = await authClient.auth.getUser();

      if (!user || cancelled) {
        setLoading(false);
        return;
      }

      const [
        profileRes,
        appsRes,
        savedRes,
        toursRes,
      ] = await Promise.all([
        // A missing/failed profile (e.g. brand-new user) must not crash the page;
        // the API creates the profile on first read, but degrade gracefully anyway.
        loadProfileWithRetry(),
        getMyAgentApplicationsAction().catch(() => [] as unknown[]),
        // A 401 here (backend failing to validate the session token)
        // must never reject the whole Promise.all — otherwise setLoading(false)
        // is skipped and the page hangs on the loading skeleton forever.
        apiClient<{
          items: {
            id: string;
            title: string;
            price: number;
            location: string;
            slug: string | null;
            county: string | null;
            area: string | null;
            images: { r2_url: string; display_order: number }[];
          }[];
          total: number;
        }>('/profiles/me/wishlist?limit=5').catch(() => null),
        toursApi
          .listMine({ sort: 'upcoming', limit: 100 })
          .catch(() => null),
      ]);

      if (!cancelled) {
        setProfileLoadFailed(profileRes === null);
        const profileData = profileRes ?? ({} as Partial<UserProfile>);
        const resolvedProfile = {
          id: profileData.id ?? user.id,
          email: (profileData.email as string) || user.email || '',
          full_name: profileData.full_name ?? null,
          avatar_url: profileData.avatar_url ?? null,
          phone: profileData.phone ?? null,
          role: profileData.role ?? null,
          campus_id: profileData.campus_id ?? null,
          home_campus_id: profileData.home_campus_id ?? null,
          home_campus_name: profileData.home_campus_name ?? null,
          home_campus_confirmed_at: profileData.home_campus_confirmed_at ?? null,
        } as Profile;
        posthog.identify(user.id, {
          role: resolvedProfile.role ?? undefined,
        });
        setProfile(resolvedProfile);
        setHasAgent(!!profileRes?.agent_id);
        setHasPendingAgentApplication(
          (appsRes as any[])?.some((app) => app.status === 'pending') ?? false,
        );

        if (savedRes && savedRes.total > 0) {
          setSavedCount(savedRes.total);
          setSavedPreview(
            (savedRes as { items: any[] }).items.map((l) => ({
              id: l.id,
              listing_id: l.id,
              listings: {
                id: l.id,
                title: l.title,
                price: l.price,
                location: l.location,
                slug: l.slug,
                county: l.county,
                area: l.area,
                listing_images: l.images?.map((img: { r2_url: string; display_order: number }) => ({
                  r2_url: img.r2_url,
                  display_order: img.display_order,
                })),
              },
            })) as OverviewSavedItem[],
          );
        }

        if (toursRes) {
          const tours = toursRes.items as unknown as OverviewUpcomingTour[];
          const activeTours = tours.filter(
            (b) =>
              b.status !== 'cancelled' &&
              b.status !== 'completed' &&
              b.status !== 'no_show',
          );
          setActiveToursCount(activeTours.length);
          setUpcomingTour(activeTours[0] || null);
        }

        setRecentlyViewed(getRecentlyViewedHostels().slice(0, 4));
        setLoading(false);
        void loadDeferred();
      }
    }

    // Phase 2 (after first paint): secondary data that fills in sections
    // below the fold — recommended hostels, platform insight and the campus
    // list used by the settings/application forms. These never block the
    // initial render.
    async function loadDeferred() {
      const [latestRes, campusesRes] = await Promise.all([
        listingsClientApi.getFeed({ limit: 1, sort: 'newest' }).catch(() => null),
        campusesApi.list('active,coming_soon').catch(() => null),
      ]);

      if (cancelled) return;

      if (campusesRes) {
        setCampuses(campusesRes as unknown as Campus[]);
      }

      if (latestRes && latestRes.items.length > 0) {
        setPlatformData({
          latestListingTitle: latestRes.items[0]?.title,
        });
      }
    }

    loadCritical().catch((e) => {
      // Last-resort guard: never leave the spinner/skeleton stuck on an
      // unexpected rejection from the critical-path loader.
      console.error('[account] loadCritical failed', e);
      if (!cancelled) setLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const handleTabChange = useCallback(
    (tab: AccountTab, hash?: string) => {
      // Sub-pages open at the top, like a new screen; the hub keeps its place.
      router.replace(`/account?tab=${tab}${hash ? `#${hash}` : ''}`, { scroll: tab !== 'overview' && !hash });
    },
    [router],
  );

  // A guest who started "Find me a hostel" on the homepage comes back here after Google sign-in;
  // send them to the page that picks up and submits their saved request, whatever tab they landed on.
  const resumeChecked = useRef(false);
  useEffect(() => {
    // Only on first landing, so a dismissed payment step never bounces them off the hub again.
    if (resumeChecked.current) return;
    resumeChecked.current = true;
    if (activeTab === 'find-a-hostel') return;
    try {
      if (sessionStorage.getItem(PENDING_REQUEST_KEY)) {
        router.replace('/account?tab=find-a-hostel', { scroll: false });
      }
    } catch {
      // Storage blocked: nothing pending to resume.
    }
  }, [activeTab, router]);

  useEffect(() => {
    if (hasAgent && activeTab === 'agent-application') {
      router.replace('/account?tab=overview', { scroll: false });
    }
  }, [hasAgent, activeTab, router]);

  if (loading) {
    return <AccountSkeleton />;
  }

  if (!profile) {
    return (
      <div className="min-h-[calc(100dvh-var(--shell-header-h))] flex items-center justify-center px-4">
        <div className="max-w-sm w-full text-center space-y-6">
          <div className="space-y-3">
            <h1 className="text-xl font-semibold text-ink tracking-tight">
              Sign in to your account
            </h1>
            <p className="text-sm text-ink-muted leading-relaxed">
              View your tours, wishlist, and manage your profile.
            </p>
          </div>

          <Link
            href="/auth/login?next=/account"
            className="flex h-12 w-full items-center justify-center rounded-xl bg-primary text-base font-semibold text-white transition-colors hover:bg-primary/90"
          >
            Sign in
          </Link>
        </div>
      </div>
    );
  }

  const setupDue = !profileLoadFailed && missingSetup(profile).required;

  return (
    <div className="min-h-[calc(100dvh-var(--shell-header-h))]">
      {setupDue && (
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 pt-4">
          <Link
            href={`${WELCOME_PATH}?next=${encodeURIComponent('/account')}`}
            className="flex items-center gap-3 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-950 transition-colors hover:bg-emerald-100"
          >
            <UserRoundCheck className="h-5 w-5 shrink-0 text-primary" aria-hidden />
            <span className="flex-1">
              <span className="font-semibold">Finish setting up your account.</span>{' '}
              Add your campus and phone so we can show hostels near you and arrange viewings.
            </span>
            <ArrowRight className="h-4 w-4 shrink-0" aria-hidden />
          </Link>
        </div>
      )}

      {profileLoadFailed && (
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 pt-4">
          <div
            role="alert"
            className="flex items-center justify-between gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900"
          >
            <span>We couldn&apos;t load your profile details. Some information may be missing.</span>
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="shrink-0 font-semibold underline underline-offset-2"
            >
              Retry
            </button>
          </div>
        </div>
      )}

      {/* Main Content Area */}
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-6 pb-24">
         {activeTab === 'overview' && (
           <AccountOverviewTab
             displayName={profile.full_name || 'Student'}
             email={profile.email}
             avatarUrl={profile.avatar_url}
             isManager={profile.role === 'manager' || profile.role === 'admin'}
             isAdmin={profile.role === 'admin'}
             savedCount={savedCount}
             activeToursCount={activeToursCount}
             upcomingTour={upcomingTour}
             savedPreview={savedPreview}
             recentlyViewed={recentlyViewed}
             platformData={platformData}
             onTabChange={handleTabChange}
             hasAgent={hasAgent}
             hasPendingAgentApplication={hasPendingAgentApplication}
             studentPhone={profile.phone}
             studentCampusId={profile.home_campus_id ?? profile.campus_id ?? null}
             studentCampusName={
               profile.home_campus_name ??
               (profile.home_campus_id
                 ? campuses.find((c) => c.id === profile.home_campus_id)?.name
                 : null) ??
               null
             }
           />
         )}

        {activeTab === 'tours' && (
          <AccountToursTab
            onBackToOverview={() => handleTabChange('overview')}
          />
        )}

        {activeTab === 'saved' && (
          <AccountSavedTab
            onBackToOverview={() => handleTabChange('overview')}
          />
        )}

        {activeTab === 'feedback' && (
          <AccountFeedbackTab
            onBackToOverview={() => handleTabChange('overview')}
          />
        )}

        {activeTab === 'settings' && (
          <AccountSettingsTab
            profile={{
              id: profile.id,
              email: profile.email,
              full_name: profile.full_name,
              phone: profile.phone,
              home_campus_id: profile.home_campus_id,
              home_campus_name: profile.home_campus_name,
            }}
            campuses={campuses}
            onProfileUpdate={(updated) => {
              setProfile((prev) => (prev ? { ...prev, ...updated } : prev));
            }}
            onBackToOverview={() => handleTabChange('overview')}
          />
        )}

        {activeTab === 'find-a-hostel' && (
          <div className="mx-auto max-w-3xl space-y-8">
            <AccountPageHeader
              title="Find me a hostel"
              description="Tell us what you're looking for. A Rumia manager reviews your request and contacts you on WhatsApp."
              onBack={() => handleTabChange('overview')}
            />
            <FindMeAHostel
              studentName={profile.full_name || 'Student'}
              studentPhone={profile.phone}
              campusId={profile.home_campus_id ?? profile.campus_id ?? null}
              campusName={
                profile.home_campus_name ??
                (profile.home_campus_id
                  ? campuses.find((c) => c.id === profile.home_campus_id)?.name
                  : null) ??
                null
              }
            />
          </div>
        )}

        {activeTab === 'agent-application' && (
          <AccountAgentApplicationTab
            onBackToOverview={() => handleTabChange('overview')}
            userProfile={{
              full_name: profile.full_name,
              phone: profile.phone,
            }}
            campuses={campuses}
            hasAgent={hasAgent}
          />
        )}
      </div>

      <PushNotificationPrompt />
    </div>
  );
}
