'use client';

import { useEffect, useState, useCallback } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { signInWithGoogle } from '@/lib/supabase/auth';
import posthog from 'posthog-js';
import { Loader2 } from 'lucide-react';
import { AccountHeader } from './account-header';
import type { AccountTab } from './account-tabs';
import {
  AccountOverviewTab,
  type OverviewUpcomingTour,
  type OverviewSavedItem,
  type RecommendedHostel,
} from './account-overview-tab';
import type { PlatformInsightData } from '@/lib/utils/insight-engine';
import { AccountToursTab } from './account-tours-tab';
import { AccountSavedTab } from './account-saved-tab';
import { AccountFeedbackTab } from './account-feedback-tab';
import { AccountSettingsTab } from './account-settings-tab';
import { ProfileCompletionModal } from './profile-completion-modal';
import { PushNotificationPrompt } from '@/components/pwa/PushNotificationPrompt';
import {
  getRecentlyViewedHostels,
  type RecentlyViewedHostel,
} from '@/lib/utils/recently-viewed';

const VALID_TABS = new Set<AccountTab>([
  'overview',
  'tours',
  'saved',
  'feedback',
  'settings',
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
}

export default function AccountPage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const activeTab = getValidTab(searchParams.get('tab'));

  const [profile, setProfile] = useState<Profile | null>(null);
  const [hasAgent, setHasAgent] = useState(false);
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
  const [recommendedHostels, setRecommendedHostels] = useState<
    RecommendedHostel[]
  >([]);
  const [platformData, setPlatformData] = useState<
    PlatformInsightData | undefined
  >(undefined);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      const supabase = createClient();
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
        savedRes,
        toursRes,
        recommendedRes,
        platformRes,
      ] = await Promise.all([
        supabase.from('profiles').select('*').eq('id', user.id).single(),
        supabase
          .from('agents')
          .select('id')
          .eq('user_id', user.id)
          .maybeSingle(),
        supabase
          .from('saved_hostels')
          .select(
            `id, listing_id, created_at,
             listings(id, title, price, location, slug, county, area,
               listing_images(r2_url, display_order))`,
          )
          .eq('user_id', user.id)
          .order('created_at', { ascending: false }),
        supabase
          .from('tour_bookings')
          .select(
            `id, status, preferred_date, preferred_time, amount, listings(id, title, area, slug, county)`,
          )
          .eq('linked_user_id', user.id)
          .order('preferred_date', { ascending: true }),
        supabase
          .from('listings')
          .select(
            'id, title, price, location, area, county, slug, room_type, listing_images(r2_url, display_order)',
          )
          .eq('is_active', true)
          .order('created_at', { ascending: false })
          .limit(3),
        supabase
          .from('listings')
          .select('title')
          .eq('is_active', true)
          .order('created_at', { ascending: false })
          .limit(1),
      ]);

      if (!cancelled) {
        const resolvedProfile = {
          ...profileRes.data,
          email: profileRes.data?.email || user.email || '',
        } as Profile;
        posthog.identify(user.id, {
          role: resolvedProfile.role ?? undefined,
        });
        setProfile(resolvedProfile);
        setHasAgent(!!agentRes.data);

        if (savedRes.data) {
          setSavedCount(savedRes.data.length);
          setSavedPreview(savedRes.data as unknown as OverviewSavedItem[]);
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

        if (recommendedRes.data) {
          setRecommendedHostels(
            recommendedRes.data as unknown as RecommendedHostel[],
          );
        }

        if (platformRes.data && platformRes.data.length > 0) {
          setPlatformData({
            latestListingTitle: platformRes.data[0]?.title,
          });
        }

        setRecentlyViewed(getRecentlyViewedHostels().slice(0, 4));
        setLoading(false);
      }
    }

    load();
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

  if (loading) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <Loader2 className="h-5 w-5 animate-spin text-slate-400" />
      </div>
    );
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

  const needsProfileCompletion =
    !profile.full_name?.trim() || !profile.phone?.trim();

  return (
    <div className="min-h-screen bg-white">
      {needsProfileCompletion && (
        <ProfileCompletionModal
          isOpen={true}
          userId={profile.id}
          currentName={profile.full_name}
          currentPhone={profile.phone}
          onSuccess={(data) => {
            setProfile((prev) =>
              prev
                ? { ...prev, full_name: data.full_name, phone: data.phone }
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
            recommendedHostels={recommendedHostels}
            recentlyViewed={recentlyViewed}
            platformData={platformData}
            onTabChange={handleTabChange}
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
            }}
            onProfileUpdate={(updated) => {
              setProfile((prev) => (prev ? { ...prev, ...updated } : prev));
            }}
            onBackToOverview={() => handleTabChange('overview')}
          />
        )}
      </main>

      <PushNotificationPrompt />
    </div>
  );
}
