'use client';

import { useState, useEffect, useCallback } from 'react';
import { Star, AlertTriangle, RefreshCw, ChevronDown, Share2 } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { profilesApi } from '@/lib/api/profiles';
import { reviewsApi } from '@/lib/api/reviews';
import { signInWithGoogle } from '@/lib/supabase/auth';
import { RatingSummary } from './rating-summary';
import { ReviewComposer } from './review-composer';
import { ReviewCard } from './review-card';
import { ShareModal } from '@/components/ui/share-modal';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils/cn';
import { categoryRatingsFromRow } from '@/lib/review-categories';
import type { Review, ReviewSummary } from '@/types';

type SortMode = 'recent' | 'highest' | 'lowest';

interface ReviewsSectionProps {
  listingId: string;
  /** Base listing URL (no query string) used to build per-review share links. */
  listingUrl?: string;
  listingName?: string;
  listingArea?: string;
  listingImageUrl?: string;
}

function buildEmptySummary(): ReviewSummary {
  return { average_rating: 0, total_reviews: 0, distribution: [], categories: [] };
}

const PAGE_SIZE = 10;

function sortReviews(rows: Review[], mode: SortMode): Review[] {
  const copy = [...rows];
  if (mode === 'highest') {
    copy.sort((a, b) => b.rating - a.rating || new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
  } else if (mode === 'lowest') {
    copy.sort((a, b) => a.rating - b.rating || new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
  } else {
    copy.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
  }
  return copy;
}

export function ReviewsSection({
  listingId,
  listingUrl,
  listingName,
  listingArea,
  listingImageUrl,
}: ReviewsSectionProps) {
  const supabase = createClient();

  const [summary, setSummary] = useState<ReviewSummary>(buildEmptySummary());
  const [reviews, setReviews] = useState<Review[]>([]);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [schoolVerified, setSchoolVerified] = useState(false);
  const [currentUserRole, setCurrentUserRole] = useState<string | null>(null);
  const [sort, setSort] = useState<SortMode>('recent');
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const [offset, setOffset] = useState(0);
  const [highlightReviewId, setHighlightReviewId] = useState<string | null>(null);
  const [shareOpen, setShareOpen] = useState(false);
  const [editingReview, setEditingReview] = useState<Review | null>(null);

  const isAuthenticated = !!currentUserId;

  const loadSummary = useCallback(async () => {
    try {
      const data = await reviewsApi.getSummary(listingId);
      if (data) {
        const parsed = data as unknown as {
          average_rating?: number | null;
          total_reviews?: number | null;
          distribution?: { rating: number; count: number }[] | null;
          categories?: { key: string; label: string; average: number | null; count: number }[] | null;
        };
        setSummary({
          average_rating: Number(parsed.average_rating ?? 0),
          total_reviews: Number(parsed.total_reviews ?? 0),
          distribution: (parsed.distribution ?? []).map((d) => ({ rating: Number(d.rating), count: Number(d.count) })),
          categories: (parsed.categories ?? []).map((c) => ({
            key: c.key,
            label: c.label,
            average: c.average != null ? Number(c.average) : null,
            count: Number(c.count),
          })),
        });
      }
    } catch {
      // Summary is best-effort; the reviews list drives the empty/error states.
    }
  }, [listingId]);

  const loadData = useCallback(
    async (mode: SortMode, startOffset: number) => {
      try {
        const [reviewsRes] = await Promise.all([
          reviewsApi.getFeed(listingId, 'published', Math.floor(startOffset / PAGE_SIZE) + 1, PAGE_SIZE),
          loadSummary(),
        ]);

        const rows = reviewsRes.items as unknown as Review[];
        setReviews(sortReviews(rows, mode));
        setHasMore(rows.length === PAGE_SIZE);
        setOffset(startOffset + rows.length);
      } catch (err: unknown) {
        setError(err instanceof Error ? err.message : 'Failed to load reviews.');
      }
    },
    [listingId, loadSummary],
  );

  useEffect(() => {
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const {
          data: { session },
        } = await supabase.auth.getSession();
        if (session?.user) {
          setCurrentUserId(session.user.id);
          const profile = await profilesApi.getMe().catch(() => null);
          setCurrentUserRole(profile?.role ?? null);
          setSchoolVerified(profile?.school_verified ?? false);
        }
        await loadData('recent', 0);
      } catch {
        setError('Failed to load reviews.');
      } finally {
        setLoading(false);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [listingId]);

  // Handle shared deep links: /hostels/...?review=<id>
  // Reading the URL once and seeding highlight state is an external-system
  // sync (not a cascading render), so the rule is disabled for this line.
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const reviewParam = new URLSearchParams(window.location.search).get('review');
    if (!reviewParam) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setHighlightReviewId(reviewParam);
  }, [listingId]);

  // Scroll + highlight once the shared review is present in the list.
  useEffect(() => {
    if (!highlightReviewId || loading) return;
    const timer = window.setTimeout(() => {
      const el = document.getElementById(`review-${highlightReviewId}`);
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'center' });
        window.setTimeout(() => setHighlightReviewId(null), 2600);
      } else if (!hasMore) {
        // The shared review is not in the current page — stop trying.
        setHighlightReviewId(null);
      }
    }, 350);
    return () => window.clearTimeout(timer);
  }, [highlightReviewId, loading, reviews, hasMore]);

  // If the shared review isn't in the first page, fetch it directly and append.
  useEffect(() => {
    if (!highlightReviewId || loading) return;
    if (reviews.some((r) => r.id === highlightReviewId)) return;
    if (!hasMore) return; // already all loaded and not found
    (async () => {
      const data = (await reviewsApi
        .getById(highlightReviewId)
        .catch(() => null)) as unknown as Review | null;
      if (!data) {
        setHighlightReviewId(null);
        return;
      }
      setReviews((prev) => {
        if (prev.some((r) => r.id === data.id)) return prev;
        return sortReviews([data, ...prev], sort);
      });
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [highlightReviewId, loading, hasMore, reviews]);

  const handleSortChange = async (mode: SortMode) => {
    setSort(mode);
    setReviews(sortReviews(reviews, mode));
  };

  const handleLoadMore = async () => {
    setLoadingMore(true);
    try {
      const res = await reviewsApi.getFeed(
        listingId,
        'published',
        Math.floor(offset / PAGE_SIZE) + 1,
        PAGE_SIZE,
      );
      const data = res.items as unknown as Review[];

      const appended = sortReviews([...reviews, ...(data ?? [])], sort);
      setReviews(appended);
      setHasMore(data.length === PAGE_SIZE);
      setOffset((prev) => prev + data.length);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to load more reviews.');
    } finally {
      setLoadingMore(false);
    }
  };

  const handleChanged = useCallback(() => {
    loadData(sort, 0);
    setEditingReview(null);
  }, [loadData, sort]);

  const handleLogin = useCallback(() => {
    signInWithGoogle(window.location.pathname);
  }, []);

  // Own review (for edit mode in composer)
  const myReview = reviews.find((r) => r.user_id === currentUserId) ?? null;

  const composerExisting = editingReview
    ? {
        id: editingReview.id,
        text: editingReview.text,
        rating_categories: categoryRatingsFromRow(editingReview as unknown as Record<string, unknown>),
      }
    : myReview
      ? {
          id: myReview.id,
          text: myReview.text,
          rating_categories: categoryRatingsFromRow(myReview as unknown as Record<string, unknown>),
        }
      : null;

  // ── Loading skeleton ──
  if (loading) {
    return (
      <section className="space-y-4">
        <h2 className="text-xl font-bold text-slate-950">Student Reviews</h2>
        <div className="rounded-2xl border border-slate-200 bg-white p-5">
          <div className="flex flex-col gap-4 sm:flex-row">
            <Skeleton className="h-12 w-24" />
            <div className="flex-1 space-y-2">
              <Skeleton className="h-2 w-full" />
              <Skeleton className="h-2 w-full" />
              <Skeleton className="h-2 w-3/4" />
            </div>
          </div>
        </div>
        <div className="space-y-3">
          {[1, 2].map((i) => (
            <div key={i} className="rounded-2xl border border-slate-200 bg-white p-5 space-y-3">
              <div className="flex items-center gap-3">
                <Skeleton className="h-10 w-10 rounded-full" />
                <div className="space-y-2">
                  <Skeleton className="h-3 w-32" />
                  <Skeleton className="h-2 w-20" />
                </div>
              </div>
              <Skeleton className="h-3 w-full" />
              <Skeleton className="h-3 w-2/3" />
            </div>
          ))}
        </div>
      </section>
    );
  }

  // ── Error state ──
  if (error && reviews.length === 0) {
    return (
      <section className="space-y-4">
        <h2 className="text-xl font-bold text-slate-950">Student Reviews</h2>
        <div className="rounded-2xl border border-red-200 bg-red-50 p-5 flex flex-col items-center gap-3 text-center">
          <AlertTriangle className="h-8 w-8 text-red-400" />
          <p className="text-sm font-semibold text-red-700">
            We couldn&apos;t load reviews.
          </p>
          <Button variant="outline" size="sm" onClick={() => { setError(null); setLoading(true); loadData(sort, 0).finally(() => setLoading(false)); }}>
            <RefreshCw className="h-4 w-4 mr-1" />
            Try again
          </Button>
        </div>
      </section>
    );
  }

  const hasReviews = summary.total_reviews > 0;

  // An empty review block reads as "nobody likes this"; show the section only once there are reviews.
  if (!hasReviews) return null;

  return (
    <section className="space-y-5">
      <div className="flex flex-col items-start justify-between gap-3 sm:flex-row sm:items-center">
        <h2 className="text-xl font-bold text-slate-950">Student Reviews</h2>
        {listingUrl && listingName && (
          <button
            type="button"
            onClick={() => setShareOpen(true)}
            className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 px-3 py-1.5 text-xs font-bold text-slate-600 hover:bg-slate-50 hover:text-slate-900"
            aria-label="Share reviews"
          >
            <Share2 className="h-3.5 w-3.5" />
            Share
          </button>
        )}
      </div>

      {hasReviews ? (
        <>
          <div className="rounded-2xl border border-slate-200 bg-white p-5">
            <RatingSummary summary={summary} />
          </div>

          <ReviewComposer
            listingId={listingId}
            isAuthenticated={isAuthenticated}
            schoolVerified={schoolVerified}
            existingReview={composerExisting}
            onSubmitted={handleChanged}
            onLoginRequest={handleLogin}
          />

          {reviews.length > 0 && (
            <div className="flex items-center justify-between">
              <p className="text-xs font-semibold text-slate-500">
                Showing {reviews.length} of {summary.total_reviews}
              </p>
              <div className="flex items-center gap-1">
                {(
                  [
                    ['recent', 'Recent'],
                    ['highest', 'Highest'],
                    ['lowest', 'Lowest'],
                  ] as const
                ).map(([value, label]) => (
                  <button
                    key={value}
                    type="button"
                    onClick={() => handleSortChange(value)}
                    className={cn(
                      'rounded-full px-3 py-1 text-xs font-semibold transition-colors',
                      sort === value
                        ? 'bg-slate-100 text-slate-800 ring-1 ring-slate-200'
                        : 'text-slate-500 hover:bg-slate-100',
                    )}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>
          )}

          <div className="space-y-3">
            {reviews.map((review) => (
              <ReviewCard
                key={review.id}
                review={review}
                currentUserId={currentUserId}
                currentUserRole={currentUserRole as 'admin' | 'manager' | 'student' | 'agent' | null}
                highlighted={highlightReviewId === review.id}
                listingShareUrl={listingUrl}
                listingShareName={listingName}
                listingShareArea={listingArea}
                listingShareImageUrl={listingImageUrl}
                onChanged={handleChanged}
                onEditRequest={() => setEditingReview(review)}
              />
            ))}
          </div>

          {hasMore && (
            <div className="flex justify-center">
              <Button variant="outline" onClick={handleLoadMore} isLoading={loadingMore}>
                {loadingMore ? 'Loading...' : (
                  <>
                    Load more reviews
                    <ChevronDown className="ml-2 h-4 w-4" />
                  </>
                )}
              </Button>
            </div>
          )}
        </>
      ) : (
        <>
          {/* Compact, intentional empty state */}
          <div className="rounded-2xl border border-slate-200 bg-white px-5 py-4 flex items-center gap-3 sm:gap-4">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-amber-50">
              <Star className="h-5 w-5 text-amber-500" />
            </div>
            <div className="min-w-0">
              <p className="text-sm font-bold text-slate-800">No reviews yet</p>
              <p className="mt-0.5 text-xs text-slate-500">
                Be the first student to share your experience with this hostel.
              </p>
            </div>
          </div>

          <ReviewComposer
            listingId={listingId}
            isAuthenticated={isAuthenticated}
            schoolVerified={schoolVerified}
            existingReview={null}
            onSubmitted={handleChanged}
            onLoginRequest={handleLogin}
          />
        </>
      )}

      {listingUrl && listingName && (
        <ShareModal
          isOpen={shareOpen}
          onClose={() => setShareOpen(false)}
          listing={{
            name: listingName,
            area: listingArea ?? '',
            url: listingUrl,
            imageUrl: listingImageUrl,
          }}
        />
      )}
    </section>
  );
}