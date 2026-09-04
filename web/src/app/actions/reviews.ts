'use server';

import { revalidatePath } from 'next/cache';
import { reviewsApi } from '@/lib/api/reviews';
import {
  REVIEW_CATEGORIES,
  computeOverallRating,
  type CategoryRatings,
} from '@/lib/review-categories';
import type { ReviewStatus } from '@/types';

type ActionResult<T = void> = { success: true; data?: T } | { success: false; error: string };

const MAX_REVIEW_TEXT_LENGTH = 2000;

function coerceCategoryRatings(raw: unknown): CategoryRatings | null {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
  const input = raw as Record<string, unknown>;
  const result: CategoryRatings = {};
  let rated = 0;
  for (const category of REVIEW_CATEGORIES) {
    const value = input[category.key];
    if (value == null) continue;
    const num = typeof value === 'number' ? value : Number(value);
    if (!Number.isFinite(num) || num < 1 || num > 5) return null;
    result[category.key] = num;
    rated += 1;
  }
  if (rated === 0) return null;
  return result;
}

export async function submitReviewAction(
  listingId: string,
  categories: CategoryRatings,
  text: string | null,
): Promise<ActionResult<{ id: string }>> {
  const categoriesPayload = coerceCategoryRatings(categories);
  if (!categoriesPayload) {
    return { success: false, error: 'Rate at least one category to submit a review.' };
  }

  const trimmedText = text?.trim() || null;
  if (trimmedText && trimmedText.length > MAX_REVIEW_TEXT_LENGTH) {
    return { success: false, error: `Review text must be ${MAX_REVIEW_TEXT_LENGTH} characters or fewer.` };
  }

  const overall = computeOverallRating(categoriesPayload);
  if (overall == null) {
    return { success: false, error: 'Rate at least one category to submit a review.' };
  }

  try {
    const review = await reviewsApi.createServer({
      listing_id: listingId,
      rating: Math.round(overall),
      text: trimmedText,
      rating_cleanliness: categoriesPayload.cleanliness,
      rating_security: categoriesPayload.security,
      rating_water: categoriesPayload.water,
      rating_wifi: categoriesPayload.wifi,
      rating_facilities: categoriesPayload.facilities,
      rating_location: categoriesPayload.location,
      rating_management: categoriesPayload.management,
      rating_value: categoriesPayload.value,
    });

    revalidatePath(`/listing/${listingId}`);
    return { success: true, data: { id: review.id } };
  } catch (err: any) {
    return { success: false, error: err.message || err.data?.detail || 'Failed to submit review.' };
  }
}

export async function updateReviewAction(
  reviewId: string,
  categories: CategoryRatings,
  text: string | null,
): Promise<ActionResult> {
  const categoriesPayload = coerceCategoryRatings(categories);
  if (!categoriesPayload) {
    return { success: false, error: 'Rate at least one category to submit a review.' };
  }

  const trimmedText = text?.trim() || null;
  if (trimmedText && trimmedText.length > MAX_REVIEW_TEXT_LENGTH) {
    return { success: false, error: `Review text must be ${MAX_REVIEW_TEXT_LENGTH} characters or fewer.` };
  }

  const overall = computeOverallRating(categoriesPayload);
  if (overall == null) {
    return { success: false, error: 'Rate at least one category to submit a review.' };
  }

  try {
    await reviewsApi.updateServer(reviewId, {
      rating: Math.round(overall),
      text: trimmedText,
      rating_cleanliness: categoriesPayload.cleanliness,
      rating_security: categoriesPayload.security,
      rating_water: categoriesPayload.water,
      rating_wifi: categoriesPayload.wifi,
      rating_facilities: categoriesPayload.facilities,
      rating_location: categoriesPayload.location,
      rating_management: categoriesPayload.management,
      rating_value: categoriesPayload.value,
    });

    revalidatePath('/dashboard');
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message || err.data?.detail || 'Failed to update review.' };
  }
}

export async function deleteReviewAction(reviewId: string): Promise<ActionResult> {
  try {
    await reviewsApi.deleteServer(reviewId);
    revalidatePath('/dashboard');
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message || err.data?.detail || 'Failed to delete review.' };
  }
}

export async function moderateReviewAction(
  reviewId: string,
  updates: { status?: ReviewStatus; text?: string },
  reason?: string,
): Promise<ActionResult> {
  try {
    const action = updates.status === 'published' ? 'approve' : updates.status === 'hidden' ? 'hide' : 'restore';
    await reviewsApi.moderateServer(reviewId, action, reason);
    revalidatePath('/admin');
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message || err.data?.detail || 'Failed to moderate review.' };
  }
}

export async function toggleReviewLikeAction(
  reviewId: string,
): Promise<ActionResult<{ liked: boolean }>> {
  try {
    const res = await reviewsApi.toggleLikeServer(reviewId);
    return { success: true, data: { liked: res.liked } };
  } catch (err: any) {
    return { success: false, error: err.message || err.data?.detail || 'Failed to toggle like.' };
  }
}

export async function submitReplyAction(
  reviewId: string,
  text: string,
): Promise<ActionResult<{ id: string }>> {
  const trimmedText = text.trim();
  if (!trimmedText) {
    return { success: false, error: 'Reply cannot be empty.' };
  }
  if (trimmedText.length > MAX_REVIEW_TEXT_LENGTH) {
    return { success: false, error: `Reply must be ${MAX_REVIEW_TEXT_LENGTH} characters or fewer.` };
  }

  try {
    const reply = await reviewsApi.addReplyServer(reviewId, trimmedText);
    return { success: true, data: { id: (reply as any)?.id || reviewId } };
  } catch (err: any) {
    return { success: false, error: err.message || err.data?.detail || 'Failed to submit reply.' };
  }
}

export async function deleteReplyAction(replyId: string): Promise<ActionResult> {
  try {
    await reviewsApi.deleteServer(replyId);
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message || err.data?.detail || 'Failed to delete reply.' };
  }
}
