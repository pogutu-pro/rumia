'use client';

import { useState } from 'react';
import {
  Star,
  ThumbsUp,
  MessageCircle,
  Share2,
  ShieldCheck,
  MoreVertical,
  Pencil,
  EyeOff,
  Trash2,
  Flag,
  Check,
  ChevronDown,
} from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { UserAvatar } from '@/components/ui/user-avatar';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { ShareModal } from '@/components/ui/share-modal';
import { cn } from '@/lib/utils/cn';
import {
  toggleReviewLikeAction,
  deleteReviewAction,
  moderateReviewAction,
  submitReplyAction,
  deleteReplyAction,
} from '@/app/actions/reviews';
import { categoryRatingsFromRow } from '@/lib/review-categories';
import type { Review, ReviewReply } from '@/types';

interface ReviewCardProps {
  review: Review;
  currentUserId: string | null;
  currentUserRole?: 'student' | 'agent' | 'manager' | 'admin' | null;
  /** True when this review was opened via a shared deep link. */
  highlighted?: boolean;
  /** Base listing URL used to build the share deep link (e.g. /hostels/x/y/z). */
  listingShareUrl?: string;
  listingShareName?: string;
  listingShareArea?: string;
  listingShareImageUrl?: string;
  onChanged?: () => void;
  onEditRequest?: () => void;
}

function formatDate(value: string): string {
  const date = new Date(value);
  return new Intl.DateTimeFormat('en', { month: 'short', day: 'numeric', year: 'numeric' }).format(date);
}

function StarRow({ rating }: { rating: number }) {
  return (
    <div className="flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map((star) => (
        <Star
          key={star}
          className={cn(
            'h-3.5 w-3.5',
            star <= rating ? 'fill-amber-400 text-amber-400' : 'fill-slate-200 text-slate-200',
          )}
        />
      ))}
    </div>
  );
}

interface ReplyRowProps {
  reply: ReviewReply;
  currentUserId: string | null;
  onChanged?: () => void;
}

function ReplyRow({ reply, currentUserId, onChanged }: ReplyRowProps) {
  const isMine = currentUserId === reply.user_id;

  const handleDelete = async () => {
    const result = await deleteReplyAction(reply.id);
    if (result.success) {
      toast.success('Reply deleted.');
      onChanged?.();
    } else {
      toast.error(result.error);
    }
  };

  return (
    <div className="rounded-xl bg-slate-50 p-3">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <UserAvatar
            name={reply.author_name || 'Student'}
            imageUrl={reply.author_avatar_url}
            size="sm"
          />
          <div className="min-w-0">
            <p className="truncate text-xs font-bold text-slate-800">
              {reply.author_name || 'Student'}
            </p>
            <p className="text-[10px] font-medium text-slate-400">{formatDate(reply.created_at)}</p>
          </div>
        </div>
        {isMine && (
          <button
            type="button"
            onClick={handleDelete}
            className="text-slate-400 hover:text-red-500 p-1 rounded"
            aria-label="Delete reply"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        )}
      </div>
      <p className="mt-2 text-sm text-slate-700">{reply.text}</p>
    </div>
  );
}

const LONG_TEXT_THRESHOLD = 260;

function ReviewBody({ text }: { text: string }) {
  const [expanded, setExpanded] = useState(false);
  const isLong = text.length > LONG_TEXT_THRESHOLD;
  const shown = isLong && !expanded ? `${text.slice(0, LONG_TEXT_THRESHOLD)}…` : text;

  return (
    <>
      <p className="mt-2 text-sm leading-relaxed text-slate-700 whitespace-pre-wrap">
        {shown}
      </p>
      {isLong && (
        <button
          type="button"
          onClick={() => setExpanded(!expanded)}
          className="mt-1 text-xs font-bold text-slate-500 hover:text-slate-800"
        >
          {expanded ? 'Read less' : 'Read more'}
        </button>
      )}
    </>
  );
}

function CategoryChips({ review }: { review: Review }) {
  const ratings = categoryRatingsFromRow(review as unknown as Record<string, unknown>);
  const [expanded, setExpanded] = useState(false);
  const entries = Object.entries(ratings);
  if (entries.length === 0) return null;

  const shown = expanded ? entries : entries.slice(0, 4);
  const remaining = entries.length - shown.length;

  return (
    <div className="mt-2.5">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] font-semibold text-slate-500">
        {shown.map(([key, value]) => (
          <span key={key} className="inline-flex items-center gap-1">
            <span className="capitalize">{key}</span>
            <span className="font-bold text-slate-800 tabular-nums">{value}</span>
            <Star className="h-2.5 w-2.5 fill-amber-400 text-amber-400" />
          </span>
        ))}
        {remaining > 0 && !expanded && (
          <button
            type="button"
            onClick={() => setExpanded(true)}
            className="inline-flex items-center gap-0.5 text-xs font-bold text-slate-600 hover:text-slate-900"
          >
            +{remaining} more
            <ChevronDown className="h-3 w-3" />
          </button>
        )}
      </div>
    </div>
  );
}

export function ReviewCard({
  review,
  currentUserId,
  currentUserRole,
  highlighted = false,
  listingShareUrl,
  listingShareName,
  listingShareArea,
  listingShareImageUrl,
  onChanged,
  onEditRequest,
}: ReviewCardProps) {
  const [isLiking, setIsLiking] = useState(false);
  const [showReply, setShowReply] = useState(false);
  const [replyText, setReplyText] = useState('');
  const [isReplying, setIsReplying] = useState(false);
  const [shareOpen, setShareOpen] = useState(false);

  const isAuthor = currentUserId === review.user_id;
  const isModerator = currentUserRole === 'admin' || currentUserRole === 'manager';

  const likeCount = review.review_likes?.length ?? 0;
  const likedByMe = !!review.review_likes?.some((l) => l.user_id === currentUserId);
  const replies = review.review_replies ?? [];

  const handleLike = async () => {
    if (!currentUserId) {
      toast.error('Sign in to like a review.');
      return;
    }
    setIsLiking(true);
    try {
      const result = await toggleReviewLikeAction(review.id);
      if (result.success) {
        onChanged?.();
      } else {
        toast.error(result.error);
      }
    } finally {
      setIsLiking(false);
    }
  };

  const handleReply = async () => {
    if (!replyText.trim()) {
      toast.error('Reply cannot be empty.');
      return;
    }
    setIsReplying(true);
    try {
      const result = await submitReplyAction(review.id, replyText);
      if (result.success) {
        setReplyText('');
        setShowReply(false);
        toast.success('Reply posted.');
        onChanged?.();
      } else {
        toast.error(result.error);
      }
    } finally {
      setIsReplying(false);
    }
  };

  const handleDelete = async () => {
    const result = await deleteReviewAction(review.id);
    if (result.success) {
      toast.success('Review deleted.');
      onChanged?.();
    } else {
      toast.error(result.error);
    }
  };

  const handleModerate = async (
    updates: { status?: 'published' | 'hidden' | 'flagged'; text?: string },
    reason?: string,
  ) => {
    const result = await moderateReviewAction(review.id, updates, reason);
    if (result.success) {
      toast.success('Review updated.');
      onChanged?.();
    } else {
      toast.error(result.error);
    }
  };

  const displayName = review.author_name || 'Student';
  const shareUrl = listingShareUrl
    ? `${listingShareUrl}${listingShareUrl.includes('?') ? '&' : '?'}review=${review.id}`
    : undefined;

  return (
    <article
      id={`review-${review.id}`}
      className={cn(
        'rounded-2xl border bg-white p-4 sm:p-5 transition-colors duration-500',
        highlighted
          ? 'border-emerald-300 ring-2 ring-emerald-200 bg-emerald-50/40'
          : 'border-slate-200',
      )}
    >
      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <UserAvatar
            name={displayName}
            imageUrl={review.author_avatar_url}
            size="md"
          />
          <div className="min-w-0">
            <div className="flex items-center gap-1.5 flex-wrap">
              <p className="text-sm font-bold text-slate-900 truncate">{displayName}</p>
              {review.school_verified_at_review_time && (
                <span className="inline-flex items-center gap-0.5 rounded-full bg-emerald-50 px-1.5 py-0.5 text-[10px] font-bold text-emerald-700">
                  <ShieldCheck className="h-3 w-3" />
                  Verified
                </span>
              )}
            </div>
            <p className="text-xs text-slate-400">{formatDate(review.created_at)}</p>
          </div>
        </div>

        {(isModerator || isAuthor) && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                type="button"
                className="inline-flex h-8 w-8 items-center justify-center rounded-full text-slate-400 hover:bg-slate-100 hover:text-slate-700"
                aria-label="Review actions"
              >
                <MoreVertical className="h-4 w-4" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-44">
              {isAuthor && (
                <DropdownMenuItem onSelect={() => onEditRequest?.()}>
                  <Pencil className="mr-2 h-4 w-4" />
                  Edit review
                </DropdownMenuItem>
              )}
              {isModerator && !isAuthor && (
                <>
                  <DropdownMenuItem onSelect={() => handleModerate({ status: 'hidden' })}>
                    <EyeOff className="mr-2 h-4 w-4" />
                    Hide review
                  </DropdownMenuItem>
                  <DropdownMenuItem onSelect={() => handleModerate({ status: 'flagged' })}>
                    <Flag className="mr-2 h-4 w-4" />
                    Flag review
                  </DropdownMenuItem>
                  <DropdownMenuItem onSelect={() => handleModerate({ status: 'published' })}>
                    <Check className="mr-2 h-4 w-4" />
                    Restore (publish)
                  </DropdownMenuItem>
                </>
              )}
              {(isAuthor || isModerator) && (
                <>
                  <DropdownMenuSeparator />
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <DropdownMenuItem onSelect={(e) => e.preventDefault()}>
                        <Trash2 className="mr-2 h-4 w-4 text-red-500" />
                        <span className="text-red-600">Delete review</span>
                      </DropdownMenuItem>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Delete this review?</AlertDialogTitle>
                        <AlertDialogDescription>
                          {isModerator && !isAuthor
                            ? 'This will permanently delete the review. The action is logged for moderation purposes.'
                            : 'This will permanently delete your review. This cannot be undone.'}
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction onClick={handleDelete} className="bg-red-600 hover:bg-red-700">
                          Delete
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </div>

      {/* Rating + text */}
      <div className="mt-3">
        <StarRow rating={Math.round(review.rating)} />
        <CategoryChips review={review} />
        {review.text && <ReviewBody text={review.text} />}
        {review.updated_at !== review.created_at && (
          <p className="mt-1 text-[10px] font-medium text-slate-400">Edited</p>
        )}
      </div>

      {/* Actions: like, reply, share */}
      <div className="mt-3 flex items-center gap-1 border-t border-slate-100 pt-3">
        <Button
          variant="ghost"
          size="sm"
          onClick={handleLike}
          disabled={isLiking}
          className={cn(
            'text-slate-500 hover:text-emerald-700',
            likedByMe && 'text-emerald-700',
          )}
          leftIcon={<ThumbsUp className={cn('h-4 w-4', likedByMe && 'fill-emerald-700')} />}
        >
          {likeCount > 0 ? likeCount : ''}
          {likedByMe ? ' Liked' : ' Like'}
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setShowReply(!showReply)}
          className="text-slate-500 hover:text-slate-800"
          leftIcon={<MessageCircle className="h-4 w-4" />}
        >
          {replies.length > 0 ? `${replies.length}` : ''}
          {replies.length > 0 ? ' Replies' : ' Reply'}
        </Button>
        {shareUrl && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setShareOpen(true)}
            className="text-slate-500 hover:text-slate-800"
            leftIcon={<Share2 className="h-4 w-4" />}
          >
            Share
          </Button>
        )}
      </div>

      {/* Replies */}
      {replies.length > 0 && (
        <div className="mt-3 space-y-2">
          {replies.map((reply) => (
            <ReplyRow
              key={reply.id}
              reply={reply}
              currentUserId={currentUserId}
              onChanged={onChanged}
            />
          ))}
        </div>
      )}

      {/* Reply composer */}
      {showReply && (
        <div className="mt-3 rounded-xl border border-slate-200 p-3">
          {currentUserId ? (
            <>
              <textarea
                value={replyText}
                onChange={(e) => setReplyText(e.target.value)}
                placeholder="Write a reply..."
                rows={2}
                maxLength={2000}
                className="w-full resize-none rounded-lg border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
              />
              <div className="mt-2 flex items-center justify-end gap-2">
                <Button variant="ghost" size="sm" onClick={() => setShowReply(false)}>
                  Cancel
                </Button>
                <Button size="sm" onClick={handleReply} isLoading={isReplying}>
                  Reply
                </Button>
              </div>
            </>
          ) : (
            <p className="text-sm text-slate-500">Sign in to reply to this review.</p>
          )}
        </div>
      )}

      {/* Share deep link */}
      {shareUrl && listingShareName && (
        <ShareModal
          isOpen={shareOpen}
          onClose={() => setShareOpen(false)}
          listing={{
            name: listingShareName,
            area: listingShareArea ?? '',
            url: shareUrl,
            imageUrl: listingShareImageUrl,
          }}
        />
      )}
    </article>
  );
}