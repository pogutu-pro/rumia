'use client';

import type { RecentlyViewedHostel } from './recently-viewed';

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

export interface UserActivityContext {
  savedCount: number;
  activeToursCount: number;
  upcomingTour?: {
    preferred_date: string;
    preferred_time: string;
    listings?: { title: string; area: string | null } | null;
  } | null;
  recentlyViewed?: RecentlyViewedHostel[];
}

export interface PlatformInsightData {
  latestListingTitle?: string;
  totalActiveListings?: number;
}

/* ------------------------------------------------------------------ */
/*  Greeting                                                           */
/* ------------------------------------------------------------------ */

function getGreetingPrefix(): string {
  const hour = new Date().getHours();
  if (hour < 12) return 'Good Morning';
  if (hour < 17) return 'Good Afternoon';
  return 'Good Evening';
}

export function getTimeBasedGreeting(name?: string | null): string {
  const prefix = getGreetingPrefix();
  const firstName = name ? name.split(' ')[0] : 'Student';
  return `${prefix}, ${firstName} 👋`;
}

/* ------------------------------------------------------------------ */
/*  Dynamic Insight Engine                                             */
/* ------------------------------------------------------------------ */

const STORAGE_KEY = 'rumia_insight_v2';
const ROTATION_TTL = 4 * 60 * 60 * 1000; // 4 hours

interface StoredInsight {
  id: string;
  ts: number;
}

function loadHistory(): StoredInsight | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function saveHistory(id: string) {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ id, ts: Date.now() }));
  } catch {
    /* silent */
  }
}

function pickCandidate(candidates: string[], lastId: string | null, expired: boolean): string {
  if (candidates.length === 0) return 'Start browsing hostels near DeKUT to find your ideal room.';
  if (candidates.length === 1) return candidates[0];

  let pool = candidates;
  if (!expired && lastId) {
    const filtered = candidates.filter((c) => c !== lastId);
    if (filtered.length > 0) pool = filtered;
  }

  const idx = Math.floor(Math.random() * pool.length);
  return pool[idx];
}

export function generateInsight(
  activity: UserActivityContext,
  platform?: PlatformInsightData,
): string {
  const candidates: string[] = [];
  const history = loadHistory();
  const now = Date.now();
  const expired = !history || now - history.ts > ROTATION_TTL;

  /* ---- Priority 1: User Activity ---- */

  if (activity.upcomingTour) {
    const tourDate = new Date(
      activity.upcomingTour.preferred_date + 'T00:00:00',
    ).toLocaleDateString('en-KE', { weekday: 'short', month: 'short', day: 'numeric' });
    const tourTitle = activity.upcomingTour.listings?.title || 'your guided tour';
    candidates.push(
      `Your tour for ${tourTitle} is on ${tourDate} — don't forget to keep your phone handy.`,
    );
    candidates.push(
      `You have a guided tour coming up on ${tourDate}. Get ready to explore your future hostel!`,
    );
  }

  if (activity.savedCount > 0) {
    candidates.push(
      `You have ${activity.savedCount} ${activity.savedCount === 1 ? 'hostel in' : 'hostels in'} your wishlist — compare them side-by-side to pick the best fit.`,
    );
    candidates.push(
      `${activity.savedCount} ${activity.savedCount === 1 ? 'hostel is' : 'hostels are'} in your wishlist. Take a closer look before rooms fill up.`,
    );
  }

  if (activity.recentlyViewed && activity.recentlyViewed.length > 0) {
    const latest = activity.recentlyViewed[0];
    candidates.push(
      `Still thinking about ${latest.title}? It's priced at KES ${latest.price.toLocaleString()}/mo — take another look.`,
    );
    if (activity.recentlyViewed.length > 1) {
      candidates.push(
        `You recently viewed ${activity.recentlyViewed.length} hostels. Pick up where you left off and narrow down your choice.`,
      );
    }
  }

  if (activity.activeToursCount === 0 && activity.savedCount === 0 && (!activity.recentlyViewed || activity.recentlyViewed.length === 0)) {
    candidates.push(
      'Welcome back! Start exploring verified hostels near DeKUT to find your perfect room.',
    );
    candidates.push(
      'Looking for a place near campus? Browse hostels with verified photos, prices, and agent contacts.',
    );
  }

  /* ---- Priority 2: Platform Insights ---- */

  if (platform?.latestListingTitle) {
    candidates.push(
      `A new hostel, "${platform.latestListingTitle}", was just added to Rumia — check it out before it's taken.`,
    );
  }

  if (platform?.totalActiveListings && platform.totalActiveListings > 0) {
    candidates.push(
      `Over ${platform.totalActiveListings} verified hostels are listed near DeKUT — there's something for every budget.`,
    );
  }

  /* ---- Priority 3: Seasonal / Academic Context ---- */

  const month = new Date().getMonth();
  if (month >= 0 && month <= 1) {
    candidates.push(
      'New semester is here — popular hostels fill up fast. Secure your room before registration week.',
    );
    candidates.push(
      'January intake is peak season for hostel hunting. Start early to get the best deals near campus.',
    );
  } else if (month >= 4 && month <= 5) {
    candidates.push(
      'Mid-year intake is approaching. Now is a great time to explore hostels with flexible lease terms.',
    );
  } else if (month >= 7 && month <= 8) {
    candidates.push(
      'September intake is around the corner — early searchers get the best rooms near DeKUT.',
    );
  } else if (month >= 10 && month <= 11) {
    candidates.push(
      'End-of-year intake period. Many students secure rooms early for the next semester.',
    );
  } else {
    candidates.push(
      'Searching early gives you more room options and better prices near campus.',
    );
    candidates.push(
      'Hostels near DeKUT go fast during peak intake. Browse verified options while availability is high.',
    );
  }

  /* ---- Rotation ---- */

  return pickCandidate(candidates, history?.id ?? null, expired);
}

/** After rendering, commit the selected insight so next rotation skips it. */
export function commitInsight(message: string) {
  saveHistory(message);
}
