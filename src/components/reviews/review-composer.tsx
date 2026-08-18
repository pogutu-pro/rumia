'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { PencilLine, ShieldCheck, ChevronDown, LogIn, Star } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import {
  REVIEW_CATEGORIES,
  computeOverallRating,
  formatOverall,
  roundedToStars,
  type CategoryRatings,
} from '@/lib/review-categories';
import { StarRatingInput } from './star-rating-input';
import { submitReviewAction, updateReviewAction } from '@/app/actions/reviews';
import { cn } from '@/lib/utils/cn';

interface ReviewComposerProps {
  listingId: string;
  isAuthenticated: boolean;
  schoolVerified: boolean;
  existingReview?: {
    id: string;
    text: string | null;
    rating_categories?: CategoryRatings | null;
    overall?: number | null;
  } | null;
  onSubmitted?: () => void;
  onLoginRequest?: () => void;
}

function buildInitialCategories(existingReview?: ReviewComposerProps['existingReview']): CategoryRatings {
  if (existingReview?.rating_categories) {
    return { ...existingReview.rating_categories };
  }
  return {};
}

export function ReviewComposer({
  listingId,
  isAuthenticated,
  schoolVerified,
  existingReview,
  onSubmitted,
  onLoginRequest,
}: ReviewComposerProps) {
  const [open, setOpen] = useState(false);
  const [categories, setCategories] = useState<CategoryRatings>(() =>
    buildInitialCategories(existingReview),
  );
  const [text, setText] = useState(existingReview?.text ?? '');
  const [isSubmitting, setIsSubmitting] = useState(false);
  // true when the user has entered text but is not yet verified — we hold the
  // draft and show the contextual verification step instead of discarding it.
  const [pendingVerification, setPendingVerification] = useState(false);

  const isEditing = !!existingReview;
  const overall = useMemo<number | null>(() => computeOverallRating(categories), [categories]);
  const hasRated = overall != null;
  const allCategoriesRated = useMemo(
    () => REVIEW_CATEGORIES.every((category) => typeof categories[category.key] === 'number'),
    [categories],
  );
  const hasTextBypassingVerification = isEditing && !!existingReview?.text;

  // Fire the "overall rating" popup exactly once, when the last category is
  // rated — avoids re-firing on every subsequent rating change.
  const previousAllRated = useRef(allCategoriesRated);
  useEffect(() => {
    if (allCategoriesRated && !previousAllRated.current) {
      toast.success(`Your overall rating is ${formatOverall(overall)}`, {
        description: 'Based on all 8 category ratings.',
      });
    }
    previousAllRated.current = allCategoriesRated;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [allCategoriesRated]);

  // Persist the draft so switching pages (or a Google re-auth bounce) never
  // discards what the user typed. Rehydrate on mount if present.
  const STORAGE_KEY = `rumia_review_draft_${listingId}`;

  const isVerifiedEnough =
    schoolVerified || (isEditing && !!existingReview?.text);

  const saveDraft = () => {
    try {
      const payload = {
        text: text.trim() || null,
        categories,
        pendingVerification,
      };
      if (payload.text || Object.keys(payload.categories).length > 0) {
        sessionStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
      } else {
        sessionStorage.removeItem(STORAGE_KEY);
      }
    } catch {
      // sessionStorage unavailable — continue without draft persistence.
    }
  };

  useEffect(() => {
    // Restore an in-progress draft once (re-auth bounce or navigation).
    // sessionStorage is an external system — reading it and seeding state is
    // the intended one-time rehydration, not a cascading render.
    try {
      const raw = sessionStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as {
          text?: string | null;
          categories?: CategoryRatings;
          pendingVerification?: boolean;
        } | null;
        if (parsed) {
          // eslint-disable-next-line react-hooks/set-state-in-effect
          if (parsed.text && !text) setText(parsed.text);
          if (parsed.categories && Object.keys(parsed.categories).length > 0) {
            setCategories((prev) => ({ ...prev, ...parsed.categories }));
          }
          if (parsed.pendingVerification) setPendingVerification(true);
          if (parsed.text || Object.keys(parsed.categories ?? {}).length > 0) {
            setOpen(true);
          }
        }
      }
    } catch {
      // ignore malformed stash
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [STORAGE_KEY]);

  useEffect(() => {
    // Keep sessionStorage draft fresh whenever inputs change.
    try {
      if (open || Object.keys(categories).length > 0) saveDraft();
    } catch {
      // ignore
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [text, categories, open, pendingVerification]);

  const handleCategoryChange = (key: keyof CategoryRatings, value: number | null) => {
    setCategories((prev) => {
      const next = { ...prev };
      if (value == null) {
        delete next[key];
      } else {
        next[key] = value;
      }
      return next;
    });
  };

  const handleSubmit = async (submitWithText: boolean) => {
    if (!hasRated) {
      toast.error('Rate at least one category to continue.');
      return;
    }

    const finalBody = submitWithText ? text : '';
    const finalText = finalBody.trim() || null;

    // Verified at review time is decided server-side from the profile; if the
    // user is unverified and entering text, we route them through the
    // contextual verification prompt (do not silently accept).
    if (finalText && !isVerifiedEnough) {
      setPendingVerification(true);
      saveDraft();
      return;
    }

    setIsSubmitting(true);
    try {
      const action = isEditing ? updateReviewAction : submitReviewAction;
      const result = await action(
        isEditing ? existingReview!.id : listingId,
        categories,
        finalText,
      );
      if (result.success) {
        toast.success(isEditing ? 'Review updated.' : 'Review submitted.');
        try {
          sessionStorage.removeItem(STORAGE_KEY);
        } catch {
          // ignore
        }
        setPendingVerification(false);
        setOpen(false);
        setText('');
        setCategories({});
        onSubmitted?.();
      } else {
        toast.error(result.error);
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleVerifyRedirect = () => {
    // Keep the draft (including the pending-verification flag) so the Google
    // re-auth bounce preserves the review body and the verification state.
    saveDraft();
    onLoginRequest?.();
  };

  // ── Signed out: prompt to sign in ──
  if (!isAuthenticated) {
    return (
      <div className="rounded-2xl border border-slate-200 bg-slate-50 p-5 flex items-center justify-between gap-4">
        <div>
          <p className="text-sm font-semibold text-slate-700">
            Have you stayed here? Share your experience.
          </p>
          <p className="mt-0.5 text-xs text-slate-500">
            Rate this hostel and tell other students what it&apos;s really like.
          </p>
        </div>
        <Button
          onClick={onLoginRequest}
          variant="outline"
          size="sm"
          leftIcon={<LogIn className="h-4 w-4" />}
          className="shrink-0"
        >
          Sign in to review
        </Button>
      </div>
    );
  }

  // ── Collapsed: single "Write a review" CTA ──
  if (!open) {
    return (
      <div className="flex items-center justify-between gap-3 border-t border-slate-100 pt-4">
        <div className="flex items-center gap-2 min-w-0">
          <PencilLine className="h-4 w-4 text-slate-400 shrink-0" />
          <span className="text-sm font-semibold text-slate-600 truncate">
            {isEditing
              ? 'You already reviewed this hostel.'
              : 'Have you stayed here? Let other students know.'}
          </span>
        </div>
        <Button
          onClick={() => {
            setOpen(true);
            setPendingVerification(false);
          }}
          variant="outline"
          size="sm"
          rightIcon={<ChevronDown className="h-4 w-4" />}
          className="shrink-0"
        >
          {isEditing ? 'Edit your review' : 'Write a review'}
        </Button>
      </div>
    );
  }

  // ── Expanded composer ──
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 space-y-5">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-bold text-slate-900">
          {isEditing ? 'Edit your review' : 'Write a review'}
        </h3>
        <div className="flex items-center gap-2">
          {schoolVerified && (
            <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-bold text-emerald-700">
              <ShieldCheck className="h-3 w-3" />
              Verified
            </span>
          )}
          <button
            type="button"
            onClick={() => setOpen(false)}
            className="text-xs font-semibold text-slate-400 hover:text-slate-600"
          >
            Cancel
          </button>
        </div>
      </div>

      <p className="text-sm font-bold text-slate-800">Rate your experience</p>
      <p className="mt-0.5 text-xs text-slate-500">
        Tap a star to rate each aspect of your stay.
        {!allCategoriesRated && ' Your overall rating appears once you rate all 8 categories.'}
      </p>

      {/* Category ratings grid — 2 columns on desktop, 1 on mobile */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {REVIEW_CATEGORIES.map((category) => (
          <div
            key={category.key}
            className="flex items-center justify-between gap-2 rounded-xl border border-slate-100 bg-slate-50/60 py-2 pl-3 pr-1.5"
          >
            <p className="min-w-0 truncate text-xs font-bold text-slate-700">
              {category.label}
            </p>
            <StarRatingInput
              value={categories[category.key] ?? 0}
              onChange={(v) => handleCategoryChange(category.key, v)}
              size="md"
            />
          </div>
        ))}
      </div>

      {/* Overall preview (derived from categories, not a second input).
          Only rendered once the user has finished rating all 8 categories —
          shown with a pop-in so completion feels rewarding without constant
          re-renders of hidden content. */}
      <AnimatePresence>
        {allCategoriesRated && (
          <motion.div
            initial={{ opacity: 0, y: 8, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2, ease: 'easeOut' }}
            className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3"
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <span className="text-2xl font-black text-slate-900 tabular-nums">
                  {hasRated ? formatOverall(overall) : '—'}
                </span>
                <div className="flex items-center gap-0.5">
                  {[1, 2, 3, 4, 5].map((star) => (
                    <Star
                      key={star}
                      className={cn(
                        'h-4 w-4',
                        hasRated && star <= roundedToStars(overall)
                          ? 'fill-amber-400 text-amber-400'
                          : 'fill-slate-200 text-slate-200',
                      )}
                    />
                  ))}
                </div>
              </div>
              <p className="text-[11px] font-bold text-amber-800">
                Overall rating
              </p>
            </div>
            <p className="mt-1 text-[11px] text-amber-700/80">
              Calculated from your category ratings above.
            </p>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Written experience — always visible, no upfront gating */}
      <div className="space-y-2">
        <label
          htmlFor={`review-text-${listingId}`}
          className="text-sm font-bold text-slate-800"
        >
          Tell other students about your experience
        </label>
        <Textarea
          id={`review-text-${listingId}`}
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="What stood out to you? How was your day-to-day stay?"
          maxLength={2000}
          className="min-h-[120px] resize-y text-sm"
        />
        <p className="flex items-center justify-between gap-2 text-[11px] text-slate-400">
          <span className="min-w-0">
            {!schoolVerified && (
              <>Written reviews are verified to help students trust experiences shared by other students.</>
            )}
          </span>
          <span className="shrink-0 tabular-nums">{text.length}/2000</span>
        </p>
      </div>

      {/* Contextual verification step — shown only when text is being submitted */}
      {pendingVerification && !isVerifiedEnough && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 space-y-3">
          <div className="flex items-start gap-2">
            <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
            <div>
              <p className="text-sm font-bold text-amber-900">
                Your review is ready to post
              </p>
              <p className="mt-0.5 text-xs leading-relaxed text-amber-800">
                Written reviews are verified to help students trust experiences
                shared by other students.
              </p>
            </div>
          </div>

          {!schoolVerified ? (
            <div className="rounded-lg border border-amber-200 bg-white px-4 py-3 flex items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="text-xs font-bold text-slate-700">
                  Verify with your DeKUT student account
                </p>
                <p className="text-xs text-slate-500">
                  Sign in with a DeKUT Google account to publish written reviews.
                </p>
              </div>
              <Button
                onClick={handleVerifyRedirect}
                variant="outline"
                size="sm"
                className="shrink-0"
                leftIcon={<LogIn className="h-4 w-4" />}
              >
                Verify & Post
              </Button>
            </div>
          ) : (
            <p className="text-xs font-semibold text-emerald-700">
              You&apos;re now verified — you can post your written review.
            </p>
          )}

          <div className="flex items-center justify-between border-t border-amber-100 pt-3">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setPendingVerification(false);
                saveDraft();
              }}
              className="text-xs text-slate-600"
            >
              Cancel
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => handleSubmit(false)}
              className="text-xs"
            >
              Submit rating only
            </Button>
          </div>
        </div>
      )}

      {/* Submit actions */}
      <div className="flex flex-wrap items-center justify-end gap-2 border-t border-slate-100 pt-4">
        {text.trim() && !hasTextBypassingVerification && !schoolVerified && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => handleSubmit(false)}
            disabled={isSubmitting}
            className="text-xs"
          >
            Submit rating only
          </Button>
        )}
        <Button
          onClick={() => handleSubmit(true)}
          isLoading={isSubmitting}
          leftIcon={<PencilLine className="h-4 w-4" />}
        >
          {isEditing ? 'Update review' : 'Post review'}
        </Button>
      </div>
    </div>
  );
}