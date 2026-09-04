'use client';

import { useEffect, useState, useCallback } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { signInWithGoogle } from '@/lib/supabase/auth';
import { apiClient } from '@/lib/api/client';
import posthog from 'posthog-js';
import { AccountHeader } from './account-header';
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
import { ProfileCompletionModal } from './profile-completion-modal';
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

function AccountSkeleton() {
  return (
    <div className="min-h-screen bg-white">
      <div className="border-b border-slate-200">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-5">
          <div className="flex items-center gap-3">
            <div className="skeleton h-10 w-10 rounded-full" />
            <div className="space-y-2">
              <div className="skeleton h-3.5 w-32" />
              <div className="skeleton h-3 w-48" />
            </div>
          </div>
        </div>
      </div>

      <main className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <div className="mb-6 flex items-center gap-6">
          <div className="skeleton h-4 w-16" />
          <div className="skeleton h-4 w-16" />
          <div className="skeleton h-4 w-16" />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="skeleton h-44 rounded-2xl" />
          ))}
        </div>
      </main>

      <span className="sr-only">Loading your account</span>
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

  useEffect(() => {
    let cancelled = false;

    // Phase 1 (critical path): only what the shell needs to paint — auth,
    // profile, tours and saved counts. Everything else is deferred to
    // loadDeferred() so the header/tabs render before the heavier queries
    // resolve, making the page feel near-instant.
    async function loadCritical() {
      const supabase = createClient();
      // Hydrate the client's in-memory session from cookies before calling
      // getUser(). The singleton browser client may have been instantiated
      // before the OAuth callback set the session cookies, so its in-memory
      // state is empty and getUser() would return null without this call.
      await supabase.auth.getSession();
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user || cancelled) {
        setLoading(false);
        return;
      }

      const [
        profileRes,
        agentRes,
        appsRes,
        savedRes,
        toursRes,
      ] = await Promise.all([
        // Use maybeSingle() because a `profiles` row may not exist yet for
        // newly authenticated users. Treat missing profile gracefully
        // instead of letting a thrown error crash the account page.
        supabase.from('profiles').select('*').eq('id', user.id).maybeSingle(),
        supabase
          .from('agents')
          .select('id')
          .eq('user_id', user.id)
          .maybeSingle(),
        getMyAgentApplicationsAction(),
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
        }>('/profiles/me/saved?limit=5'),
        supabase
          .from('tour_bookings')
          .select(
            `id, status, preferred_date, preferred_time, amount, listings(id, title, area, slug, county)`,
          )
          .eq('linked_user_id', user.id)
          .order('preferred_date', { ascending: true }),
      ]);

      if (!cancelled) {
        const profileData = profileRes?.data ?? {};
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
        setHasAgent(!!agentRes.data);
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

        if (toursRes.data) {
          const tours = toursRes.data as unknown as OverviewUpcomingTour[];
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
      const supabase = createClient();
      const [platformRes, campusesRes] = await Promise.all([
        supabase
          .from('listings')
          .select('title')
          .eq('is_active', true)
          .order('created_at', { ascending: false })
          .limit(1),
        supabase
          .from('campuses')
          .select('*')
          .in('status', ['active', 'coming_soon'])
          .order('name', { ascending: true }),
      ]);

      if (cancelled) return;

      if (campusesRes.data) {
        setCampuses(campusesRes.data as Campus[]);
      }

      if (platformRes.data && platformRes.data.length > 0) {
        setPlatformData({
          latestListingTitle: platformRes.data[0]?.title,
        });
      }
    }

    loadCritical();
    return () => {
      cancelled = true;
    };
  }, []);

  const handleTabChange = useCallback(
    (tab: AccountTab) => {
      router.replace(`/account?tab=${tab}`, { scroll: false });
    },
    [router],
  );

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
      <div className="min-h-screen bg-white flex items-center justify-center px-4">
        <div className="max-w-sm w-full text-center space-y-6">
          <div className="space-y-3">
            <h1 className="text-xl font-semibold text-slate-900 tracking-tight">
              Sign in to your account
            </h1>
            <p className="text-sm text-slate-500 leading-relaxed">
              View your tours, saved hostels, and manage your profile.
            </p>
          </div>

          <button
            onClick={() => signInWithGoogle('/account')}
            className="w-full flex items-center justify-center gap-3 h-11 border border-slate-300 rounded-lg font-medium text-slate-800 hover:bg-slate-50 transition-colors text-sm cursor-pointer"
          >
            <svg className="h-5 w-5 shrink-0" viewBox="0 0 24 24">
              <path
                d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z"
                fill="#4285F4"
              />
              <path
                d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                fill="#34A853"
              />
              <path
                d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                fill="#FBBC05"
              />
              <path
                d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                fill="#EA4335"
              />
            </svg>
            Continue with Google
          </button>
        </div>
      </div>
    );
  }

  const missingName = !profile.full_name?.trim();
  const missingPhone = !profile.phone?.trim();
  // The user's home university is only considered complete once they have
  // explicitly confirmed it. Auto-stamped values (the DeKUT backfill) are not
  // trusted, so every unconfirmed profile is prompted exactly once.
  const missingCampus = !profile.home_campus_confirmed_at;
  const needsProfileCompletion = missingName || missingPhone || missingCampus;

  return (
    <div className="min-h-screen bg-white">
      {needsProfileCompletion && (
        <ProfileCompletionModal
          isOpen={true}
          userId={profile.id}
          currentName={profile.full_name}
          currentPhone={profile.phone}
          currentCampusId={profile.home_campus_id ?? profile.campus_id ?? null}
          currentCampusName={profile.home_campus_name}
          campuses={campuses}
          requireName={missingName}
          requirePhone={missingPhone}
          requireCampus={missingCampus}
          onSuccess={(data) => {
            setProfile((prev) =>
              prev
                ? {
                    ...prev,
                    ...(data.full_name !== undefined
                      ? { full_name: data.full_name }
                      : {}),
                    ...(data.phone !== undefined
                      ? { phone: data.phone }
                      : {}),
                    home_campus_id:
                      data.home_campus_id !== undefined
                        ? data.home_campus_id
                        : prev.home_campus_id,
                    home_campus_name:
                      data.home_campus_name !== undefined
                        ? data.home_campus_name
                        : prev.home_campus_name,
                    home_campus_confirmed_at:
                      data.home_campus_confirmed_at !== undefined
                        ? data.home_campus_confirmed_at
                        : prev.home_campus_confirmed_at,
                  }
                : prev,
            );
          }}
        />
      )}

      {/* Clean Account Header */}
      <AccountHeader
        fullName={profile.full_name}
        email={profile.email}
        avatarUrl={profile.avatar_url}
        isAdmin={profile.role === 'admin'}
        isManager={profile.role === 'manager' || profile.role === 'admin'}
        hasAgent={hasAgent}
      />

      {/* Main Content Area */}
      <main className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-6 pb-24">
         {activeTab === 'overview' && (
           <AccountOverviewTab
             displayName={profile.full_name || 'Student'}
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
      </main>

      <PushNotificationPrompt />
    </div>
  );
}
