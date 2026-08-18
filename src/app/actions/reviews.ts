'use server';

import { createClient } from '@/lib/supabase/server';
import { supabaseAdmin } from '@/lib/supabase/admin';
import {
  REVIEW_CATEGORIES,
  computeOverallRating,
  categoryColumnsFromCategories,
  type CategoryRatings,
} from '@/lib/review-categories';
import type { ReviewStatus } from '@/types';

type ActionResult<T = void> = { success: true; data?: T } | { success: false; error: string };

const MAX_REVIEW_TEXT_LENGTH = 2000;

// ── Validation helpers ───────────────────────────────────────────────────

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

// ── Submit a review (category ratings + optional text) ───────────────────

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

  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) {
    return { success: false, error: 'You must be signed in to submit a review.' };
  }

  // Check school verification for written reviews
  const { data: profile } = await supabase
    .from('profiles')
    .select('school_verified, full_name, avatar_url')
    .eq('id', user.id)
    .maybeSingle();

  if (trimmedText && !profile?.school_verified) {
    return { success: false, error: 'Only verified DeKUT students can write review text. You can still submit a rating.' };
  }

  const overall = computeOverallRating(categoriesPayload);
  if (overall == null) {
    return { success: false, error: 'Rate at least one category to submit a review.' };
  }

  try {
    const { data, error } = await supabase
      .from('reviews')
      .insert({
        listing_id: listingId,
        user_id: user.id,
        rating: Math.round(overall),
        text: trimmedText,
        author_name: profile?.full_name || user.user_metadata?.full_name || user.user_metadata?.name || null,
        author_avatar_url: profile?.avatar_url || user.user_metadata?.avatar_url || user.user_metadata?.picture || null,
        school_verified_at_review_time: profile?.school_verified ?? false,
        ...categoryColumnsFromCategories(categoriesPayload),
      })
      .select('id')
      .single();

    if (error) {
      if (error.code === '23505') {
        return { success: false, error: 'You have already reviewed this hostel. You can edit your existing review.' };
      }
      return { success: false, error: error.message };
    }

    return { success: true, data: { id: data.id } };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unexpected error';
    return { success: false, error: message };
  }
}

// ── Update a review (author only) ────────────────────────────────────────

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

  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) {
    return { success: false, error: 'You must be signed in.' };
  }

  // Verify ownership
  const { data: existing } = await supabase
    .from('reviews')
    .select('id, user_id, text, rating')
    .eq('id', reviewId)
    .maybeSingle();

  if (!existing || existing.user_id !== user.id) {
    return { success: false, error: 'You can only edit your own review.' };
  }

  // Check school verification for adding text
  if (trimmedText && !existing.text) {
    const { data: profile } = await supabase
      .from('profiles')
      .select('school_verified')
      .eq('id', user.id)
      .maybeSingle();

    if (!profile?.school_verified) {
      return { success: false, error: 'Only verified DeKUT students can add review text.' };
    }
  }

  const overall = computeOverallRating(categoriesPayload);
  if (overall == null) {
    return { success: false, error: 'Rate at least one category to submit a review.' };
  }

  try {
    const { error } = await supabase
      .from('reviews')
      .update({
        rating: Math.round(overall),
        text: trimmedText,
        ...categoryColumnsFromCategories(categoriesPayload),
      })
      .eq('id', reviewId);

    if (error) return { success: false, error: error.message };
    return { success: true };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unexpected error';
    return { success: false, error: message };
  }
}

// ── Delete a review (author or admin/manager) ────────────────────────────

export async function deleteReviewAction(reviewId: string): Promise<ActionResult> {
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) {
    return { success: false, error: 'You must be signed in.' };
  }

  const { data: existing } = await supabase
    .from('reviews')
    .select('id, user_id, listing_id, rating, text, status')
    .eq('id', reviewId)
    .maybeSingle();

  if (!existing) {
    return { success: false, error: 'Review not found.' };
  }

  const isAuthor = existing.user_id === user.id;
  if (!isAuthor) {
    // Check admin/manager permission via service role
    const { data: profile } = await supabaseAdmin
      .from('profiles')
      .select('role, managed_campus_id, managed_region_id')
      .eq('id', user.id)
      .maybeSingle();

    const isAdmin = profile?.role === 'admin';
    const isManager = profile?.role === 'manager';

    if (!isAdmin && !isManager) {
      return { success: false, error: 'You can only delete your own review.' };
    }

    if (isManager && !isAdmin) {
      // Verify campus scope
      const { data: listing } = await supabaseAdmin
        .from('listings')
        .select('campus_id')
        .eq('id', existing.listing_id)
        .maybeSingle();

      if (!listing) return { success: false, error: 'Listing not found.' };

      const { data: managerProfile } = await supabaseAdmin
        .from('profiles')
        .select('managed_campus_id, managed_region_id')
        .eq('id', user.id)
        .maybeSingle();

      if (managerProfile?.managed_campus_id && listing.campus_id !== managerProfile.managed_campus_id) {
        return { success: false, error: 'You can only moderate reviews within your campus.' };
      }
    }

    // Log moderator action before hard delete (using service role to bypass RLS)
    await supabaseAdmin.from('review_moderation_log').insert({
      review_id: existing.id,
      review_listing_id: existing.listing_id,
      review_user_id: existing.user_id,
      actor_user_id: user.id,
      action: 'delete',
      previous_status: existing.status,
      previous_text: existing.text,
      previous_rating: existing.rating,
    });
  }

  try {
    const { error } = await supabaseAdmin
      .from('reviews')
      .delete()
      .eq('id', reviewId);

    if (error) return { success: false, error: error.message };
    return { success: true };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unexpected error';
    return { success: false, error: message };
  }
}

// ── Moderate a review (admin/manager status change or text edit) ──────────

export async function moderateReviewAction(
  reviewId: string,
  updates: { status?: ReviewStatus; text?: string },
  reason?: string,
): Promise<ActionResult> {
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) {
    return { success: false, error: 'You must be signed in.' };
  }

  const { data: profile } = await supabaseAdmin
    .from('profiles')
    .select('role, managed_campus_id, managed_region_id')
    .eq('id', user.id)
    .maybeSingle();

  const isAdmin = profile?.role === 'admin';
  const isManager = profile?.role === 'manager';

  if (!isAdmin && !isManager) {
    return { success: false, error: 'Unauthorized.' };
  }

  const { data: existing } = await supabaseAdmin
    .from('reviews')
    .select('id, user_id, listing_id, rating, text, status')
    .eq('id', reviewId)
    .maybeSingle();

  if (!existing) return { success: false, error: 'Review not found.' };

  // Manager campus scope check
  if (isManager && !isAdmin) {
    const { data: listing } = await supabaseAdmin
      .from('listings')
      .select('campus_id')
      .eq('id', existing.listing_id)
      .maybeSingle();

    if (!listing) return { success: false, error: 'Listing not found.' };

    if (profile?.managed_campus_id && listing.campus_id !== profile.managed_campus_id) {
      return { success: false, error: 'You can only moderate reviews within your campus.' };
    }
  }

  // Build update object and log entry
  const updateData: Record<string, unknown> = {};
  const logEntry: Record<string, unknown> = {
    review_id: existing.id,
    review_listing_id: existing.listing_id,
    review_user_id: existing.user_id,
    actor_user_id: user.id,
    reason: reason?.trim() || null,
  };

  if (updates.status && updates.status !== existing.status) {
    updateData.status = updates.status;
    logEntry.action = 'status_change';
    logEntry.previous_status = existing.status;
    logEntry.new_status = updates.status;
  }

  const trimmedNewText = updates.text?.trim() ?? undefined;
  if (trimmedNewText !== undefined && trimmedNewText !== existing.text) {
    updateData.text = trimmedNewText || null;
    logEntry.action = 'text_edit';
    logEntry.previous_text = existing.text;
    logEntry.new_text = trimmedNewText || null;
  }

  if (Object.keys(updateData).length === 0) {
    return { success: false, error: 'No changes to apply.' };
  }

  try {
    const { error } = await supabaseAdmin
      .from('reviews')
      .update(updateData)
      .eq('id', reviewId);

    if (error) return { success: false, error: error.message };

    // Write audit log
    if (logEntry.action) {
      await supabaseAdmin.from('review_moderation_log').insert(logEntry);
    }

    return { success: true };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unexpected error';
    return { success: false, error: message };
  }
}

// ── Toggle like ──────────────────────────────────────────────────────────

export async function toggleReviewLikeAction(
  reviewId: string,
): Promise<ActionResult<{ liked: boolean }>> {
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) {
    return { success: false, error: 'You must be signed in to like a review.' };
  }

  try {
    // Check if already liked
    const { data: existing } = await supabase
      .from('review_likes')
      .select('id')
      .eq('review_id', reviewId)
      .eq('user_id', user.id)
      .maybeSingle();

    if (existing) {
      // Unlike
      const { error } = await supabase
        .from('review_likes')
        .delete()
        .eq('id', existing.id);

      if (error) return { success: false, error: error.message };
      return { success: true, data: { liked: false } };
    }

    // Like
    const { error } = await supabase
      .from('review_likes')
      .insert({ review_id: reviewId, user_id: user.id });

    if (error) return { success: false, error: error.message };
    return { success: true, data: { liked: true } };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unexpected error';
    return { success: false, error: message };
  }
}

// ── Submit a reply ───────────────────────────────────────────────────────

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

  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) {
    return { success: false, error: 'You must be signed in to reply.' };
  }

  // Snapshot author display identity (profiles RLS only exposes own row, so
  // the name/avatar must be stored on the reply for public rendering).
  const { data: profile } = await supabase
    .from('profiles')
    .select('full_name, avatar_url')
    .eq('id', user.id)
    .maybeSingle();

  try {
    const { data, error } = await supabase
      .from('review_replies')
      .insert({
        review_id: reviewId,
        user_id: user.id,
        text: trimmedText,
        author_name: profile?.full_name || user.user_metadata?.full_name || user.user_metadata?.name || null,
        author_avatar_url: profile?.avatar_url || user.user_metadata?.avatar_url || user.user_metadata?.picture || null,
      })
      .select('id')
      .single();

    if (error) return { success: false, error: error.message };
    return { success: true, data: { id: data.id } };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unexpected error';
    return { success: false, error: message };
  }
}

// ── Delete a reply ───────────────────────────────────────────────────────

export async function deleteReplyAction(replyId: string): Promise<ActionResult> {
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) {
    return { success: false, error: 'You must be signed in.' };
  }

  const { data: existing } = await supabase
    .from('review_replies')
    .select('id, user_id')
    .eq('id', replyId)
    .maybeSingle();

  if (!existing) return { success: false, error: 'Reply not found.' };

  const isAuthor = existing.user_id === user.id;
  if (!isAuthor) {
    const { data: profile } = await supabaseAdmin
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .maybeSingle();

    if (profile?.role !== 'admin') {
      return { success: false, error: 'You can only delete your own reply.' };
    }
  }

  try {
    const { error } = await supabaseAdmin
      .from('review_replies')
      .delete()
      .eq('id', replyId);

    if (error) return { success: false, error: error.message };
    return { success: true };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unexpected error';
    return { success: false, error: message };
  }
}
