import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  Pressable,
} from 'react-native';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { PencilLine, ShieldCheck, ChevronDown, LogIn, Star } from 'lucide-react-native';
import { apiFetch } from '../../lib/api/client';
import type { ReviewCreate } from '../../lib/api/schema';
import {
  REVIEW_CATEGORIES,
  categoryColumnsFromCategories,
  computeOverallRating,
  formatOverall,
  roundedToStars,
  type CategoryRatings,
} from '../../lib/review-categories';
import { palette, radii } from '../../lib/theme';

interface ExistingReview {
  id: string;
  text: string | null;
  rating_cleanliness?: number | null;
  rating_security?: number | null;
  rating_water?: number | null;
  rating_wifi?: number | null;
  rating_facilities?: number | null;
  rating_location?: number | null;
  rating_management?: number | null;
  rating_value?: number | null;
}

interface ReviewComposerProps {
  listingId: string;
  isAuthenticated: boolean;
  existingReview?: ExistingReview | null;
  schoolVerified?: boolean;
  onSubmitted?: () => void;
  onLoginRequest?: () => void;
}

function buildInitialCategories(existingReview?: ExistingReview | null): CategoryRatings {
  if (!existingReview) return {};
  const result: CategoryRatings = {};
  for (const category of REVIEW_CATEGORIES) {
    const value = existingReview[`rating_${category.key}`] ?? null;
    if (typeof value === 'number' && value >= 1 && value <= 5) {
      result[category.key] = value;
    }
  }
  return result;
}

function StarRatingInput({
  value,
  onChange,
}: {
  value: number;
  onChange: (value: number | null) => void;
}) {
  return (
    <View style={styles.starsRow}>
      {[1, 2, 3, 4, 5].map((star) => {
        const filled = star <= value;
        return (
          <Pressable key={star} hitSlop={8} onPress={() => onChange(star === value ? null : star)}>
            <Star
              size={20}
              fill={filled ? palette.amber[500] : 'transparent'}
              color={filled ? palette.amber[500] : palette.slate[300]}
            />
          </Pressable>
        );
      })}
    </View>
  );
}

export function ReviewComposer({
  listingId,
  isAuthenticated,
  existingReview,
  schoolVerified = false,
  onSubmitted,
  onLoginRequest,
}: ReviewComposerProps) {
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [categories, setCategories] = useState<CategoryRatings>(() =>
    buildInitialCategories(existingReview),
  );
  const [text, setText] = useState(existingReview?.text ?? '');

  const isEditing = !!existingReview;
  const overall = useMemo<number | null>(() => computeOverallRating(categories), [categories]);
  const hasRated = overall != null;
  const allCategoriesRated = useMemo(
    () => REVIEW_CATEGORIES.every((category) => typeof categories[category.key] === 'number'),
    [categories],
  );

  const mutation = useMutation({
    mutationFn: (payload: ReviewCreate) => {
      return existingReview
        ? apiFetch(`/reviews/${existingReview.id}`, { method: 'PUT', body: JSON.stringify(payload) })
        : apiFetch('/reviews', { method: 'POST', body: JSON.stringify(payload) });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['listing-reviews', listingId] });
      queryClient.invalidateQueries({ queryKey: ['listing-review-summary', listingId] });
      setText('');
      setCategories({});
      setOpen(false);
      onSubmitted?.();
    },
  });

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

  const handleSubmit = () => {
    if (!hasRated) {
      return;
    }
    const finalText = text.trim() || null;
    const payload: ReviewCreate = {
      listing_id: listingId,
      rating: roundedToStars(overall) || 1,
      text: finalText || 'No written review provided.',
      ...categoryColumnsFromCategories(categories),
    };
    mutation.mutate(payload);
  };

  if (!isAuthenticated) {
    return (
      <View style={styles.box}>
        <View style={styles.boxText}>
          <Text style={styles.promptTitle}>Have you stayed here? Share your experience.</Text>
          <Text style={styles.promptSubtitle}>
            Rate this hostel and tell other students what it's really like.
          </Text>
        </View>
        <TouchableOpacity style={styles.signInButton} onPress={onLoginRequest}>
          <LogIn size={14} color={palette.slate[700]} />
          <Text style={styles.signInButtonText}>Sign in to review</Text>
        </TouchableOpacity>
      </View>
    );
  }

  if (!open) {
    return (
      <View style={styles.collapsedRow}>
        <View style={styles.collapsedLabel}>
          <PencilLine size={16} color={palette.slate[400]} />
          <Text style={styles.collapsedText}>
            {isEditing
              ? 'You already reviewed this hostel.'
              : 'Have you stayed here? Let other students know.'}
          </Text>
        </View>
        <TouchableOpacity style={styles.writeButton} onPress={() => setOpen(true)}>
          <Text style={styles.writeButtonText}>
            {isEditing ? 'Edit your review' : 'Write a review'}
          </Text>
          <ChevronDown size={14} color={palette.slate[700]} />
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.expanded}>
      <View style={styles.expandedHeader}>
        <Text style={styles.expandedTitle}>{isEditing ? 'Edit your review' : 'Write a review'}</Text>
        <View style={styles.expandedHeaderRight}>
          {schoolVerified && (
            <View style={styles.verifiedBadge}>
              <ShieldCheck size={10} color={palette.emerald[700]} />
              <Text style={styles.verifiedBadgeText}>Verified</Text>
            </View>
          )}
          <TouchableOpacity onPress={() => setOpen(false)} hitSlop={8}>
            <Text style={styles.cancelText}>Cancel</Text>
          </TouchableOpacity>
        </View>
      </View>

      <Text style={styles.sectionLabel}>Rate your experience</Text>
      <Text style={styles.sectionHint}>
        Tap a star to rate each aspect of your stay.
        {!allCategoriesRated && ' Your overall rating appears once you rate all 8 categories.'}
      </Text>

      <View style={styles.categoriesGrid}>
        {REVIEW_CATEGORIES.map((category) => (
          <View key={category.key} style={styles.categoryRow}>
            <Text style={styles.categoryLabel} numberOfLines={1}>
              {category.label}
            </Text>
            <StarRatingInput
              value={categories[category.key] ?? 0}
              onChange={(value) => handleCategoryChange(category.key, value)}
            />
          </View>
        ))}
      </View>

      {allCategoriesRated && (
        <View style={styles.overallBox}>
          <View style={styles.overallLeft}>
            <Text style={styles.overallValue}>{hasRated ? formatOverall(overall) : '—'}</Text>
            <View style={styles.overallStars}>
              {[1, 2, 3, 4, 5].map((star) => (
                <Star
                  key={star}
                  size={14}
                  fill={hasRated && star <= roundedToStars(overall) ? palette.amber[400] : palette.slate[200]}
                  color={hasRated && star <= roundedToStars(overall) ? palette.amber[400] : palette.slate[200]}
                />
              ))}
            </View>
          </View>
          <Text style={styles.overallLabel}>Overall rating</Text>
        </View>
      )}

      <Text style={styles.sectionLabel}>Tell other students about your experience</Text>
      <TextInput
        style={styles.textInput}
        value={text}
        onChangeText={setText}
        placeholder="What stood out to you? How was your day-to-day stay?"
        placeholderTextColor={palette.slate[400]}
        multiline
        maxLength={2000}
        textAlignVertical="top"
      />
      <Text style={styles.charCount}>{text.length}/2000</Text>

      <View style={styles.submitRow}>
        <TouchableOpacity
          style={[styles.submitButton, (!hasRated || mutation.isPending) && styles.buttonDisabled]}
          onPress={handleSubmit}
          disabled={!hasRated || mutation.isPending}
        >
          {mutation.isPending ? (
            <ActivityIndicator color="#ffffff" size="small" />
          ) : (
            <>
              <PencilLine size={14} color="#ffffff" />
              <Text style={styles.submitButtonText}>
                {isEditing ? 'Update review' : 'Post review'}
              </Text>
            </>
          )}
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  box: {
    borderWidth: 1,
    borderColor: palette.slate[200],
    backgroundColor: palette.slate[50],
    borderRadius: radii['2xl'],
    padding: 18,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  boxText: { flex: 1 },
  promptTitle: { color: palette.slate[700], fontSize: 14, fontWeight: '700' },
  promptSubtitle: { color: palette.slate[500], fontSize: 12, marginTop: 2 },
  signInButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderWidth: 1,
    borderColor: palette.slate[300],
    backgroundColor: '#ffffff',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 9,
  },
  signInButtonText: { color: palette.slate[700], fontWeight: '700', fontSize: 13 },
  collapsedRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: palette.slate[100],
    paddingTop: 14,
    gap: 12,
  },
  collapsedLabel: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 6, minWidth: 0 },
  collapsedText: { color: palette.slate[600], fontSize: 13, fontWeight: '600', flexShrink: 1 },
  writeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    borderWidth: 1,
    borderColor: palette.slate[300],
    backgroundColor: '#ffffff',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 9,
  },
  writeButtonText: { color: palette.slate[700], fontWeight: '700', fontSize: 13 },
  expanded: {
    borderWidth: 1,
    borderColor: palette.slate[200],
    backgroundColor: '#ffffff',
    borderRadius: radii['2xl'],
    padding: 18,
    gap: 10,
  },
  expandedHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  expandedHeaderRight: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  expandedTitle: { color: palette.slate[900], fontSize: 15, fontWeight: '800' },
  verifiedBadge: { flexDirection: 'row', alignItems: 'center', gap: 3 },
  verifiedBadgeText: { color: palette.emerald[700], fontSize: 10, fontWeight: '800' },
  cancelText: { color: palette.slate[400], fontSize: 12, fontWeight: '600' },
  sectionLabel: { color: palette.slate[800], fontSize: 13, fontWeight: '700', marginTop: 4 },
  sectionHint: { color: palette.slate[500], fontSize: 12, marginBottom: 2, lineHeight: 17 },
  categoriesGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  categoryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 8,
    backgroundColor: palette.slate[50],
    borderRadius: 12,
    borderWidth: 1,
    borderColor: palette.slate[100],
    paddingVertical: 8,
    paddingHorizontal: 10,
    width: '48%',
    minWidth: 150,
  },
  categoryLabel: { flex: 1, marginRight: 6, color: palette.slate[700], fontSize: 12, fontWeight: '700' },
  starsRow: { flexDirection: 'row', gap: 1, alignItems: 'center' },
  overallBox: {
    backgroundColor: palette.amber[50],
    borderColor: palette.amber[200],
    borderWidth: 1,
    borderRadius: 12,
    padding: 13,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 2,
  },
  overallLeft: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  overallValue: { color: palette.slate[900], fontSize: 24, fontWeight: '900', letterSpacing: -0.5 },
  overallStars: { flexDirection: 'row', gap: 1, alignItems: 'center' },
  overallLabel: { color: palette.amber[800], fontSize: 11, fontWeight: '700' },
  textInput: {
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: palette.slate[200],
    borderRadius: 12,
    padding: 12,
    color: palette.slate[800],
    fontSize: 14,
    minHeight: 110,
    textAlignVertical: 'top',
  },
  charCount: { color: palette.slate[400], fontSize: 11, textAlign: 'right' },
  submitRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    marginTop: 4,
    borderTopWidth: 1,
    borderTopColor: palette.slate[100],
    paddingTop: 14,
  },
  submitButton: {
    backgroundColor: palette.slate[900],
    paddingHorizontal: 18,
    paddingVertical: 11,
    borderRadius: 9,
    alignItems: 'center',
    flexDirection: 'row',
    gap: 6,
  },
  submitButtonText: { color: '#ffffff', fontWeight: '700', fontSize: 14 },
  buttonDisabled: { opacity: 0.6 },
});