'use client';

import { useMemo } from 'react';
import Link from 'next/link';
import {
  CalendarCheck,
  Heart,
  MessageSquare,
  Settings,
  Compass,
  ArrowRight,
  GitCompareArrows,
  Building2,
  Clock,
} from 'lucide-react';
import type { AccountTab } from './account-tabs';
import { TourCountdown } from '@/components/tour-countdown';
import {
  getTimeBasedGreeting,
  generateInsight,
  commitInsight,
  type UserActivityContext,
  type PlatformInsightData,
} from '@/lib/utils/insight-engine';
import type { RecentlyViewedHostel } from '@/lib/utils/recently-viewed';
import { FindMeAHostel } from './find-me-a-hostel';

export interface OverviewUpcomingTour {
  id: string;
  preferred_date: string;
  preferred_time: string;
  status: string;
  amount: number;
  listings?: {
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
  savedCount: number;
  activeToursCount: number;
  upcomingTour: OverviewUpcomingTour | null;
  savedPreview: OverviewSavedItem[];
  recentlyViewed: RecentlyViewedHostel[];
  platformData?: PlatformInsightData;
  onTabChange: (tab: AccountTab) => void;
  hasAgent?: boolean;
  hasPendingAgentApplication?: boolean;
  studentPhone?: string | null;
  studentCampusId?: string | null;
  studentCampusName?: string | null;
}

export function AccountOverviewTab({
  displayName,
  savedCount,
  activeToursCount,
  upcomingTour,
  savedPreview,
  recentlyViewed,
  platformData,
  onTabChange,
  hasAgent = false,
  hasPendingAgentApplication = false,
  studentPhone = null,
  studentCampusId = null,
  studentCampusName = null,
}: AccountOverviewTabProps) {
  const greeting = useMemo(() => getTimeBasedGreeting(displayName), [displayName]);

  const insight = useMemo(() => {
    const activity: UserActivityContext = {
      savedCount,
      activeToursCount,
      upcomingTour,
      recentlyViewed,
    };
    const message = generateInsight(activity, platformData);
    commitInsight(message);
    return message;
  }, [savedCount, activeToursCount, upcomingTour, recentlyViewed, platformData]);

  return (
    <div className="space-y-6 sm:space-y-8">
      {/* 1. Welcome & Greeting Banner */}
      <div className="bg-slate-50 border border-slate-200/80 rounded-2xl p-4 sm:p-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-4">
          <div className="space-y-1">
            <h2 className="text-lg sm:text-2xl font-bold text-slate-900 tracking-tight">
              {greeting}
            </h2>
            <p className="text-xs sm:text-sm text-slate-600">
              {insight}
            </p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <Link
              href="/hostels"
              className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold transition-colors shadow-sm"
            >
              <Compass className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
              Browse Hostels
            </Link>
          </div>
        </div>
      </div>

      {/* 2. Interactive Navigation Cards Grid — 2-Column Grid on Mobile */}
      <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-2 gap-3 sm:gap-6">
        {/* Tours Card */}
        <div
          onClick={() => onTabChange('tours')}
          className="group cursor-pointer rounded-2xl border border-slate-200/80 bg-white p-3.5 sm:p-5 hover:border-slate-300 hover:shadow-md transition-all space-y-3 flex flex-col justify-between"
        >
          <div className="space-y-2.5 sm:space-y-3">
            <div className="flex items-center justify-between">
              <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
                <CalendarCheck className="h-4 w-4 sm:h-5 sm:w-5" />
              </div>
              <span className="text-[10px] sm:text-xs font-bold px-2 py-0.5 sm:px-2.5 sm:py-1 rounded-full bg-slate-100 text-slate-700 tabular-nums">
                {activeToursCount} {activeToursCount === 1 ? 'Tour' : 'Tours'}
              </span>
            </div>

            <div>
              <h3 className="text-xs sm:text-base font-bold text-slate-900 group-hover:text-emerald-700 transition-colors leading-tight">
                Tour Bookings & Visits
              </h3>
              <p className="text-[11px] sm:text-xs text-slate-500 mt-0.5 line-clamp-2 hidden sm:block">
                Manage upcoming, completed, and cancelled guided hostel tours near DeKUT.
              </p>
            </div>

            {upcomingTour && (
              <div className="p-2 sm:p-3 rounded-xl bg-slate-50 border border-slate-200/60 space-y-1">
                <div className="flex items-center justify-between text-[9px] sm:text-[11px]">
                  <span className="font-bold text-emerald-800 bg-emerald-100 px-1.5 py-0.2 rounded-full">
                    Next Tour
                  </span>
                </div>
                <p className="text-[11px] sm:text-xs font-bold text-slate-900 truncate">
                  {upcomingTour.listings?.title || 'Guided Tour'}
                </p>
                <TourCountdown
                  preferredDate={upcomingTour.preferred_date}
                  preferredTime={upcomingTour.preferred_time as 'morning' | 'afternoon' | 'evening'}
                  compact
                />
              </div>
            )}
          </div>

          <div className="flex items-center justify-between pt-2.5 sm:pt-3 border-t border-slate-100 text-[11px] sm:text-xs font-bold text-slate-900 group-hover:text-emerald-700">
            <span>View Tours</span>
            <ArrowRight className="h-3.5 w-3.5 sm:h-4 sm:w-4 group-hover:translate-x-1 transition-transform" />
          </div>
        </div>

        {/* Saved Hostels & Compare Card */}
        <div
          onClick={() => onTabChange('saved')}
          className="group cursor-pointer rounded-2xl border border-slate-200/80 bg-white p-3.5 sm:p-5 hover:border-slate-300 hover:shadow-md transition-all space-y-3 flex flex-col justify-between"
        >
          <div className="space-y-2.5 sm:space-y-3">
            <div className="flex items-center justify-between">
              <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-xl bg-rose-50 text-rose-600 flex items-center justify-center">
                <Heart className="h-4 w-4 sm:h-5 sm:w-5" />
              </div>
              <span className="text-[10px] sm:text-xs font-bold px-2 py-0.5 sm:px-2.5 sm:py-1 rounded-full bg-slate-100 text-slate-700 tabular-nums">
                {savedCount} Saved
              </span>
            </div>

            <div>
              <h3 className="text-xs sm:text-base font-bold text-slate-900 group-hover:text-rose-600 transition-colors leading-tight">
                Saved & Compare
              </h3>
              <p className="text-[11px] sm:text-xs text-slate-500 mt-0.5 line-clamp-2 hidden sm:block">
                Review your saved hostels and compare prices, room types, and amenities.
              </p>
            </div>

            {savedPreview.length > 0 && (
              <div className="flex items-center gap-1.5 overflow-hidden pt-0.5">
                {savedPreview.slice(0, 3).map((item) => {
                  const image = item.listings?.listing_images?.sort(
                    (a, b) => a.display_order - b.display_order
                  )[0];
                  return (
                    <div
                      key={item.id}
                      className="w-9 h-9 sm:w-11 sm:h-11 rounded-lg bg-slate-100 border border-slate-200 overflow-hidden shrink-0"
                    >
                      {image ? (
                        <img src={image.r2_url} alt="" className="w-full h-full object-cover" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center">
                          <Heart className="h-3 w-3 text-slate-300" />
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          <div className="flex items-center justify-between pt-2.5 sm:pt-3 border-t border-slate-100 text-[11px] sm:text-xs font-bold text-slate-900 group-hover:text-rose-600">
            <span className="flex items-center gap-1">
              <GitCompareArrows className="h-3 w-3 sm:h-3.5 sm:w-3.5" />
              Saved & Compare
            </span>
            <ArrowRight className="h-3.5 w-3.5 sm:h-4 sm:w-4 group-hover:translate-x-1 transition-transform" />
          </div>
        </div>

        {/* Feedback Card */}
        <div
          onClick={() => onTabChange('feedback')}
          className="group cursor-pointer rounded-2xl border border-slate-200/80 bg-white p-3.5 sm:p-5 hover:border-slate-300 hover:shadow-md transition-all space-y-3 flex flex-col justify-between"
        >
          <div className="space-y-2.5 sm:space-y-3">
            <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center">
              <MessageSquare className="h-4 w-4 sm:h-5 sm:w-5" />
            </div>

            <div>
              <h3 className="text-xs sm:text-base font-bold text-slate-900 group-hover:text-blue-600 transition-colors leading-tight">
                Share Feedback
              </h3>
              <p className="text-[11px] sm:text-xs text-slate-500 mt-0.5 line-clamp-2 hidden sm:block">
                Have suggestions or issues? Send feedback to help us improve Rumia.
              </p>
            </div>
          </div>

          <div className="flex items-center justify-between pt-2.5 sm:pt-3 border-t border-slate-100 text-[11px] sm:text-xs font-bold text-slate-900 group-hover:text-blue-600">
            <span>Feedback Form</span>
            <ArrowRight className="h-3.5 w-3.5 sm:h-4 sm:w-4 group-hover:translate-x-1 transition-transform" />
          </div>
        </div>

        {/* Account Settings Card */}
        <div
          onClick={() => onTabChange('settings')}
          className="group cursor-pointer rounded-2xl border border-slate-200/80 bg-white p-3.5 sm:p-5 hover:border-slate-300 hover:shadow-md transition-all space-y-3 flex flex-col justify-between"
        >
          <div className="space-y-2.5 sm:space-y-3">
            <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-xl bg-slate-100 text-slate-700 flex items-center justify-center">
              <Settings className="h-4 w-4 sm:h-5 sm:w-5" />
            </div>

            <div>
              <h3 className="text-xs sm:text-base font-bold text-slate-900 group-hover:text-slate-700 transition-colors leading-tight">
                Account Settings
              </h3>
              <p className="text-[11px] sm:text-xs text-slate-500 mt-0.5 line-clamp-2 hidden sm:block">
                Update profile info, notification preferences, or sign out.
              </p>
            </div>
          </div>

          <div className="flex items-center justify-between pt-2.5 sm:pt-3 border-t border-slate-100 text-[11px] sm:text-xs font-bold text-slate-900 group-hover:text-slate-700">
            <span>Edit Profile</span>
            <ArrowRight className="h-3.5 w-3.5 sm:h-4 sm:w-4 group-hover:translate-x-1 transition-transform" />
          </div>
        </div>
      </div>

      {/* Become an Agent Banner — hidden for existing agents */}
      {!hasAgent && (
        hasPendingAgentApplication ? (
          <div className="group cursor-pointer rounded-2xl bg-white text-slate-900 border border-slate-200 p-4 sm:p-6 transition-all flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 shadow-sm">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <Clock className="h-5 w-5 text-slate-400" />
                <h3 className="text-sm sm:text-base font-bold text-slate-900">
                  Agent Application Pending
                </h3>
              </div>
              <p className="text-xs sm:text-sm text-slate-500">
                Your application is under review. You will be notified once it is approved.
              </p>
            </div>
            <button className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs sm:text-sm rounded-xl transition-colors shrink-0 flex items-center gap-1.5 cursor-pointer">
              <span>Pending Verification</span>
            </button>
          </div>
        ) : (
          <div
            onClick={() => onTabChange('agent-application')}
            className="group cursor-pointer rounded-2xl bg-slate-900 text-white p-4 sm:p-6 hover:bg-slate-800 transition-all flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 shadow-sm"
          >
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <Building2 className="h-5 w-5 text-slate-300" />
                <h3 className="text-sm sm:text-base font-bold text-white">
                  Own or Manage a Hostel? Become a Rumia Agent
                </h3>
              </div>
              <p className="text-xs sm:text-sm text-slate-300">
                Submit an application to list your property, manage listings, and receive verified student leads for your campus.
              </p>
            </div>
            <button className="px-4 py-2 bg-white hover:bg-slate-200 text-slate-900 font-bold text-xs sm:text-sm rounded-xl transition-colors shrink-0 flex items-center gap-1.5 cursor-pointer">
              <span>Apply Now</span>
              <ArrowRight className="h-4 w-4 group-hover:translate-x-1 transition-transform" />
            </button>
          </div>
        )
      )}

      {/* 3. Find Me a Hostel — request feature replaces Recommended Hostels */}
      <FindMeAHostel
        studentName={displayName}
        studentPhone={studentPhone}
        campusId={studentCampusId}
        campusName={studentCampusName}
      />
    </div>
  );
}
