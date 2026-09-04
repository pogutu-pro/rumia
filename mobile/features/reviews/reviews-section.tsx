import React, { useMemo, useState } from 'react';
import { View, Text, StyleSheet, Pressable, ActivityIndicator, TextInput } from 'react-native';
import { useRouter } from 'expo-router';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Star,
  ThumbsUp,
  MessageCircle,
  ShieldCheck,
  AlertTriangle,
} from 'lucide-react-native';
import { apiFetch } from '../../lib/api/client';
import type { Review, ReviewSummary, ReviewsPage } from '../../lib/api/schema';
import { categoryRatingsFromRow, REVIEW_CATEGORIES } from '../../lib/review-categories';
import { useSessionStore } from '../../stores/session';
import { ReviewComposer } from './review-composer';
import { Skeleton } from '../../lib/components/ui';
import { palette, radii } from '../../lib/theme';

type SortMode = 'recent' | 'highest' | 'lowest';

function fmtAverage(value: number): string {
  return (Math.round(value * 10) / 10).toFixed(1);
}

function formatDate(value: string): string {
  return new Date(value).toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

function Stars({ rating, size = 14 }: { rating: number; size?: number }) {
  const rounded = Math.round(rating);
  return (
    <View style={styles.starsRow}>
      {[1, 2, 3, 4, 5].map((star) => (
        <Star
          key={star}
          size={size}
          fill={star <= rounded ? palette.amber[500] : palette.slate[200]}
          color={star <= rounded ? palette.amber[500] : palette.slate[200]}
        />
      ))}
    </View>
  );
}

function RatingSummary({ summary }: { summary: ReviewSummary }) {
  const { average_rating, total_reviews, distribution, categories } = summary;
  const [showAll, setShowAll] = useState(false);

  const countsByRating = new Map<number, number>();
  distribution.forEach((d) => countsByRating.set(d.rating, d.count));
  const rows = [5, 4, 3, 2, 1].map((rating) => ({
    rating,
    count: countsByRating.get(rating) ?? 0,
    percentage: total_reviews > 0 ? (countsByRating.get(rating) ?? 0) / total_reviews : 0,
  }));

  return (
    <View style={styles.summary}>
      <View style={styles.summaryTop}>
        <View style={styles.summaryScore}>
          <Text style={styles.summaryNumber}>{fmtAverage(average_rating)}</Text>
          <View>
            <Stars rating={average_rating} />
            <Text style={styles.summaryCount}>
              {total_reviews} {total_reviews === 1 ? 'review' : 'reviews'}
            </Text>
          </View>
        </View>

        <View style={styles.distribution}>
          {rows.map((row) => (
            <View key={row.rating} style={styles.distributionRow}>
              <Text style={styles.distributionLabel}>{row.rating}</Text>
              <View style={styles.distributionTrack}>
                <View style={[styles.distributionFill, { width: `${row.percentage * 100}%` }]} />
              </View>
              <Text style={styles.distributionCount}>{row.count}</Text>
            </View>
          ))}
        </View>
      </View>

      {categories.length > 0 && (
        <View style={styles.categoryBlock}>
          <View style={styles.categoryGrid}>
            {(showAll ? categories : categories.slice(0, 4)).map((cat) => (
              <View key={cat.key} style={styles.categoryRow}>
                <Text style={styles.categoryLabel} numberOfLines={1}>
                  {cat.label}
                </Text>
                <View style={styles.categoryValue}>
                  <Text style={styles.categoryNumber}>
                    {cat.average != null ? fmtAverage(cat.average) : '—'}
                  </Text>
                  <Star size={11} fill={palette.amber[500]} color={palette.amber[500]} />
                </View>
              </View>
            ))}
          </View>
          {categories.length > 4 && (
            <Pressable onPress={() => setShowAll((v) => !v)} hitSlop={8}>
              <Text style={styles.showAll}>{showAll ? 'Show less' : 'Show all categories'}</Text>
            </Pressable>
          )}
        </View>
      )}
    </View>
  );
}

function ReviewCardRow({
  review,
  isMine,
  onChanged,
  onEditRequest,
  onLoginRequest,
}: {
  review: Review;
  isMine: boolean;
  onChanged: () => void;
  onEditRequest: () => void;
  onLoginRequest: () => void;
}) {
  const queryClient = useQueryClient();
  const isAuthenticated = useSessionStore((s) => s.isAuthenticated);
  const [showReply, setShowReply] = useState(false);
  const [replyText, setReplyText] = useState('');
  const [expanded, setExpanded] = useState(false);

  const likeMutation = useMutation({
    mutationFn: () => apiFetch(`/reviews/${review.id}/like`, { method: 'POST' }),
    onSuccess: onChanged,
  });

  const replyMutation = useMutation({
    mutationFn: (text: string) =>
      apiFetch(`/reviews/${review.id}/reply`, { method: 'POST', body: JSON.stringify({ text }) }),
    onSuccess: () => {
      setReplyText('');
      setShowReply(false);
      onChanged();
    },
  });

  const isLong = review.text.length > 260;
  const shown = isLong && !expanded ? `${review.text.slice(0, 260)}…` : review.text;
  const ratings = categoryRatingsFromRow(review);
  const labelFor = (key: string) => REVIEW_CATEGORIES.find((c) => c.key === key)?.shortLabel ?? key;
  const categoryEntries = Object.entries(ratings);
  const categoryShown = expanded ? categoryEntries : categoryEntries.slice(0, 4);
  const remaining = categoryEntries.length - categoryShown.length;

  return (
    <View style={styles.reviewCard}>
      <View style={styles.reviewHeader}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>{(review.author_name || 'S').charAt(0).toUpperCase()}</Text>
        </View>
        <View style={styles.reviewHeaderText}>
          <View style={styles.nameRow}>
            <Text style={styles.reviewerName} numberOfLines={1}>
              {review.author_name || 'Anonymous Student'}
            </Text>
            {isMine && <Text style={styles.youBadge}>You</Text>}
            {review.school_verified_at_review_time && (
              <View style={styles.verifiedBadge}>
                <ShieldCheck size={10} color={palette.emerald[700]} />
                <Text style={styles.verifiedText}>Verified</Text>
              </View>
            )}
          </View>
          <Text style={styles.reviewDate}>{formatDate(review.created_at)}</Text>
        </View>
        {isMine && (
          <Pressable onPress={onEditRequest} hitSlop={8}>
            <Text style={styles.editText}>Edit</Text>
          </Pressable>
        )}
      </View>

      <View style={styles.reviewBody}>
        <Stars rating={review.rating} />

        {categoryEntries.length > 0 && (
          <View style={styles.categoryChips}>
            {categoryShown.map(([key, value]) => (
              <View key={key} style={styles.categoryChip}>
                <Text style={styles.categoryChipLabel}>{labelFor(key)}</Text>
                <Text style={styles.categoryChipValue}>{value}</Text>
                <Star size={9} fill={palette.amber[500]} color={palette.amber[500]} />
              </View>
            ))}
            {remaining > 0 && !expanded && (
              <Pressable onPress={() => setExpanded(true)} hitSlop={6}>
                <Text style={styles.moreChips}>+{remaining} more</Text>
              </Pressable>
            )}
          </View>
        )}

        {review.text !== 'No written review provided.' && <Text style={styles.reviewText}>{shown}</Text>}
        {isLong && (
          <Pressable onPress={() => setExpanded((v) => !v)} hitSlop={6}>
            <Text style={styles.readMore}>{expanded ? 'Read less' : 'Read more'}</Text>
          </Pressable>
        )}
        {review.updated_at !== review.created_at && (
          <Text style={styles.edited}>Edited</Text>
        )}
      </View>

      <View style={styles.actions}>
        <Pressable
          style={styles.action}
          onPress={() => (isAuthenticated ? likeMutation.mutate() : onLoginRequest())}
          disabled={likeMutation.isPending}
        >
          <ThumbsUp
            size={14}
            color={palette.slate[500]}
            fill={review.like_count > 0 ? palette.emerald[700] : 'transparent'}
          />
          <Text style={styles.actionText}>
            {review.like_count > 0 ? review.like_count : ''} {review.like_count > 0 ? 'Likes' : 'Like'}
          </Text>
        </Pressable>
        <Pressable style={styles.action} onPress={() => setShowReply((v) => !v)}>
          <MessageCircle size={14} color={palette.slate[500]} />
          <Text style={styles.actionText}>
            {review.reply_count > 0 ? review.reply_count : ''}{' '}
            {review.reply_count > 0 ? 'Replies' : 'Reply'}
          </Text>
        </Pressable>
      </View>

      {review.replies.length > 0 && (
        <View style={styles.replies}>
          {review.replies.map((reply) => (
            <View key={reply.id} style={styles.replyRow}>
              <Text style={styles.replyAuthor}>
                {(reply.author_name || 'Student').charAt(0).toUpperCase()}
              </Text>
              <View style={styles.replyBody}>
                <Text style={styles.replyName}>{reply.author_name || 'Student'}</Text>
                <Text style={styles.replyText}>{reply.text}</Text>
              </View>
            </View>
          ))}
        </View>
      )}

      {showReply && (
        <View style={styles.replyComposer}>
          {isAuthenticated ? (
            <>
              <TextInput
                style={styles.replyInput}
                value={replyText}
                onChangeText={setReplyText}
                placeholder="Write a reply..."
                placeholderTextColor={palette.slate[400]}
                multiline
                maxLength={2000}
              />
              <View style={styles.replyActions}>
                <Pressable onPress={() => setShowReply(false)} hitSlop={8}>
                  <Text style={styles.replyCancel}>Cancel</Text>
                </Pressable>
                <Pressable
                  style={[styles.replyPost, !replyText.trim() && styles.replyPostDisabled]}
                  onPress={() => replyText.trim() && replyMutation.mutate(replyText.trim())}
                  disabled={!replyText.trim() || replyMutation.isPending}
                >
                  {replyMutation.isPending ? (
                    <ActivityIndicator color="#ffffff" size="small" />
                  ) : (
                    <Text style={styles.replyPostText}>Reply</Text>
                  )}
                </Pressable>
              </View>
            </>
          ) : (
            <Text style={styles.replySignIn}>Sign in to reply to this review.</Text>
          )}
        </View>
      )}
    </View>
  );
}

export function ReviewsSection({ listingId }: { listingId: string }) {
  const queryClient = useQueryClient();
  const userId = useSessionStore((s) => s.user?.id);
  const router = useRouter();
  const isAuthenticated = useSessionStore((s) => s.isAuthenticated);
  const [sort, setSort] = useState<SortMode>('recent');
  const [editingReviewId, setEditingReviewId] = useState<string | null>(null);

  const { data: summary, isLoading: loadingSummary } = useQuery<ReviewSummary>({
    queryKey: ['listing-review-summary', listingId],
    queryFn: () => apiFetch(`/reviews/summary/${listingId}`),
  });

  const { data: reviewsData, isLoading, error } = useQuery<ReviewsPage>({
    queryKey: ['listing-reviews', listingId],
    queryFn: () => apiFetch('/reviews', { params: { listing_id: listingId, limit: 50 } }),
  });

  const allReviews = reviewsData?.items ?? [];
  const reviewList = useMemo(() => {
    const copy = [...allReviews];
    if (sort === 'highest') {
      copy.sort((a, b) => b.rating - a.rating || new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
    } else if (sort === 'lowest') {
      copy.sort((a, b) => a.rating - b.rating || new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
    } else {
      copy.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
    }
    return copy;
  }, [allReviews, sort]);

  const total = reviewsData?.total ?? 0;
  const myReview = allReviews.find((review) => review.user_id === userId) ?? null;
  const editingReview = editingReviewId ? allReviews.find((r) => r.id === editingReviewId) ?? null : null;

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ['listing-reviews', listingId] });
    queryClient.invalidateQueries({ queryKey: ['listing-review-summary', listingId] });
  };

  return (
    <View style={styles.container}>
      <Text style={styles.sectionTitle}>Student Reviews</Text>

      {isLoading || loadingSummary ? (
        <View style={styles.skeletonBlock}>
          <Skeleton style={styles.skeletonSummary} />
          <Skeleton style={styles.skeletonCard} />
        </View>
      ) : error ? (
        <View style={styles.errorCard}>
          <AlertTriangle size={28} color={palette.red[500]} />
          <Text style={styles.errorText}>We couldn't load reviews.</Text>
          <Pressable style={styles.retryButton} onPress={() => invalidate()}>
            <Text style={styles.retryText}>Try again</Text>
          </Pressable>
        </View>
      ) : total > 0 && summary ? (
        <>
          <View style={styles.summaryCard}>
            <RatingSummary summary={summary} />
          </View>
        </>
      ) : null}

      <ReviewComposer
        listingId={listingId}
        isAuthenticated={isAuthenticated}
        existingReview={myReview ?? editingReview}
        key={editingReviewId ?? 'new'}
        onSubmitted={invalidate}
        onLoginRequest={() => router.push('/(auth)/login')}
      />

      {total === 0 && !isLoading ? (
        <View style={styles.emptyCard}>
          <View style={styles.emptyIcon}>
            <Star size={18} color={palette.amber[500]} />
          </View>
          <View style={styles.emptyBody}>
            <Text style={styles.emptyTitle}>No reviews yet</Text>
            <Text style={styles.emptyText}>
              Be the first to rate this hostel and help other students choose well.
            </Text>
          </View>
        </View>
      ) : null}

      {reviewList.length > 0 && (
        <>
          <View style={styles.listToolbar}>
            <Text style={styles.showingText}>
              Showing {reviewList.length} of {total}
            </Text>
            <View style={styles.sortPills}>
              {(
                [
                  ['recent', 'Recent'],
                  ['highest', 'Highest'],
                  ['lowest', 'Lowest'],
                ] as const
              ).map(([value, label]) => {
                const selected = sort === value;
                return (
                  <Pressable
                    key={value}
                    style={[styles.sortPill, selected && styles.sortPillActive]}
                    onPress={() => setSort(value)}
                  >
                    <Text style={[styles.sortPillText, selected && styles.sortPillTextActive]}>
                      {label}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </View>

          <View style={styles.reviewList}>
            {reviewList.map((review) => (
              <ReviewCardRow
                key={review.id}
                review={review}
                isMine={review.user_id === userId}
                onChanged={invalidate}
                onEditRequest={() => setEditingReviewId(review.id)}
                onLoginRequest={() => router.push('/(auth)/login')}
              />
            ))}
          </View>
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { marginTop: 28, gap: 14 },
  sectionTitle: { color: palette.slate[950], fontSize: 20, fontWeight: '800', letterSpacing: -0.3 },
  skeletonBlock: { gap: 12 },
  skeletonSummary: { height: 200, borderRadius: 16 },
  skeletonCard: { height: 180, borderRadius: 16 },
  errorCard: {
    borderRadius: radii['2xl'],
    borderWidth: 1,
    borderColor: palette.red[200],
    backgroundColor: palette.red[50],
    padding: 18,
    alignItems: 'center',
    gap: 8,
  },
  errorText: { color: palette.red[700], fontSize: 14, fontWeight: '700' },
  retryButton: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 10, borderWidth: 1, borderColor: palette.red[300] },
  retryText: { color: palette.red[600], fontSize: 12, fontWeight: '700' },
  summaryCard: {
    borderWidth: 1,
    borderColor: palette.slate[200],
    backgroundColor: '#ffffff',
    borderRadius: radii['2xl'],
    padding: 18,
  },
  summary: { gap: 18 },
  summaryTop: { flexDirection: 'row', alignItems: 'center', gap: 20 },
  summaryScore: { alignItems: 'center', gap: 6 },
  summaryNumber: { color: palette.slate[900], fontSize: 40, fontWeight: '900', letterSpacing: -1 },
  summaryCount: { color: palette.slate[500], fontSize: 12, fontWeight: '600', marginTop: 2 },
  starsRow: { flexDirection: 'row', gap: 1 },
  distribution: { flex: 1, gap: 6 },
  distributionRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  distributionLabel: { width: 14, textAlign: 'right', color: palette.slate[500], fontSize: 11, fontWeight: '800' },
  distributionTrack: { flex: 1, height: 6, borderRadius: 3, backgroundColor: palette.slate[100], overflow: 'hidden' },
  distributionFill: { height: '100%', borderRadius: 3, backgroundColor: palette.amber[400] },
  distributionCount: { width: 20, textAlign: 'right', color: palette.slate[400], fontSize: 11, fontWeight: '700' },
  categoryBlock: { borderTopWidth: 1, borderTopColor: palette.slate[100], paddingTop: 16, gap: 8 },
  categoryGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  categoryRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', width: '48%', minWidth: 140 },
  categoryLabel: { color: palette.slate[500], fontSize: 12, fontWeight: '600', flex: 1 },
  categoryValue: { flexDirection: 'row', alignItems: 'center', gap: 3 },
  categoryNumber: { color: palette.slate[900], fontSize: 12, fontWeight: '800' },
  showAll: { color: palette.slate[500], fontSize: 12, fontWeight: '800', marginTop: 2 },
  emptyCard: {
    borderRadius: radii['2xl'],
    borderWidth: 1,
    borderColor: palette.slate[200],
    backgroundColor: '#ffffff',
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  emptyIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: palette.amber[50],
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyBody: { flex: 1 },
  emptyTitle: { color: palette.slate[800], fontSize: 14, fontWeight: '800' },
  emptyText: { color: palette.slate[500], fontSize: 12, marginTop: 2, lineHeight: 17 },
  listToolbar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 4 },
  showingText: { color: palette.slate[500], fontSize: 12, fontWeight: '600' },
  sortPills: { flexDirection: 'row', gap: 6 },
  sortPill: {
    paddingHorizontal: 12,
    height: 30,
    borderRadius: radii.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sortPillActive: { backgroundColor: palette.slate[100], borderWidth: 1, borderColor: palette.slate[200] },
  sortPillText: { color: palette.slate[500], fontSize: 12, fontWeight: '700' },
  sortPillTextActive: { color: palette.slate[800] },
  reviewList: { gap: 12 },
  reviewCard: {
    borderWidth: 1,
    borderColor: palette.slate[200],
    backgroundColor: '#ffffff',
    borderRadius: radii['2xl'],
    padding: 16,
  },
  reviewHeader: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: palette.slate[100],
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: { color: palette.slate[600], fontSize: 16, fontWeight: '800' },
  reviewHeaderText: { flex: 1, minWidth: 0 },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  reviewerName: { color: palette.slate[900], fontSize: 14, fontWeight: '800', flexShrink: 1 },
  youBadge: {
    backgroundColor: palette.emerald[50],
    color: palette.emerald[700],
    fontSize: 10,
    fontWeight: '800',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    overflow: 'hidden',
  },
  verifiedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: palette.emerald[50],
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  verifiedText: { color: palette.emerald[700], fontSize: 10, fontWeight: '800' },
  reviewDate: { color: palette.slate[400], fontSize: 12, marginTop: 2 },
  editText: { color: palette.slate[500], fontSize: 12, fontWeight: '700' },
  reviewBody: { marginTop: 12, gap: 6 },
  categoryChips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, alignItems: 'center' },
  categoryChip: { flexDirection: 'row', alignItems: 'center', gap: 3 },
  categoryChipLabel: { color: palette.slate[500], fontSize: 11, fontWeight: '700', textTransform: 'capitalize' },
  categoryChipValue: { color: palette.slate[800], fontSize: 11, fontWeight: '800' },
  moreChips: { color: palette.slate[600], fontSize: 12, fontWeight: '800' },
  reviewText: { color: palette.slate[700], fontSize: 14, lineHeight: 21, marginTop: 4 },
  readMore: { color: palette.slate[500], fontSize: 12, fontWeight: '800', marginTop: 2 },
  edited: { color: palette.slate[400], fontSize: 10, fontWeight: '500', marginTop: 2 },
  actions: {
    flexDirection: 'row',
    gap: 6,
    borderTopWidth: 1,
    borderTopColor: palette.slate[100],
    paddingTop: 10,
    marginTop: 12,
  },
  action: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    height: 32,
    borderRadius: 8,
  },
  actionText: { color: palette.slate[500], fontSize: 13, fontWeight: '700' },
  replies: { gap: 8, marginTop: 10 },
  replyRow: { flexDirection: 'row', gap: 10, backgroundColor: palette.slate[50], borderRadius: 12, padding: 10 },
  replyAuthor: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: palette.slate[200],
    textAlign: 'center',
    lineHeight: 28,
    color: palette.slate[600],
    fontSize: 12,
    fontWeight: '800',
  },
  replyBody: { flex: 1 },
  replyName: { color: palette.slate[800], fontSize: 12, fontWeight: '800' },
  replyText: { color: palette.slate[700], fontSize: 13, marginTop: 2, lineHeight: 18 },
  replyComposer: {
    borderRadius: radii.xl,
    borderWidth: 1,
    borderColor: palette.slate[200],
    padding: 12,
    marginTop: 10,
    gap: 10,
  },
  replyInput: {
    borderRadius: 10,
    borderWidth: 1,
    borderColor: palette.slate[200],
    padding: 10,
    color: palette.slate[800],
    fontSize: 13,
    minHeight: 60,
    textAlignVertical: 'top',
  },
  replyActions: { flexDirection: 'row', justifyContent: 'flex-end', gap: 12, alignItems: 'center' },
  replyCancel: { color: palette.slate[500], fontSize: 13, fontWeight: '700' },
  replyPost: {
    backgroundColor: palette.slate[900],
    paddingHorizontal: 16,
    height: 34,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
  },
  replyPostDisabled: { opacity: 0.5 },
  replyPostText: { color: '#ffffff', fontSize: 13, fontWeight: '700' },
  replySignIn: { color: palette.slate[500], fontSize: 13 },
});