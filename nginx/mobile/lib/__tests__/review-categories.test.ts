import {
  REVIEW_CATEGORIES,
  categoryColumnsFromCategories,
  categoryFromColumn,
  categoryRatingsFromRow,
  columnForCategory,
  computeOverallRating,
  formatOverall,
  roundedToStars,
} from '../review-categories';

describe('review-categories', () => {
  it('exports exactly 8 equal-weight categories in stable order', () => {
    expect(REVIEW_CATEGORIES).toHaveLength(8);
    const keys = REVIEW_CATEGORIES.map((c) => c.key);
    expect(keys).toEqual([
      'cleanliness',
      'security',
      'water',
      'wifi',
      'facilities',
      'location',
      'management',
      'value',
    ]);
    expect(REVIEW_CATEGORIES.map((c) => c.order)).toEqual([1, 2, 3, 4, 5, 6, 7, 8]);
    expect(REVIEW_CATEGORIES.every((c) => c.weight === 1)).toBe(true);
  });

  it('maps category keys to rating_<key> columns and back', () => {
    expect(columnForCategory('wifi')).toBe('rating_wifi');
    expect(categoryFromColumn('rating_water')).toBe('water');
    expect(categoryFromColumn('other_field')).toBeNull();
    expect(categoryFromColumn('rating_unknown')).toBeNull();
  });

  it('computes a rounded one-decimal overall from provided categories', () => {
    const overall = computeOverallRating({
      cleanliness: 5,
      security: 5,
      water: 5,
      wifi: 5,
      facilities: 5,
      location: 5,
      management: 5,
      value: 5,
    });
    expect(overall).toBe(5);
  });

  it('averages only supplied categories with equal weight', () => {
    const overall = computeOverallRating({ cleanliness: 4, security: 2 });
    expect(overall).toBe(3);
  });

  it('ignores out-of-range values and returns null when none are valid', () => {
    expect(computeOverallRating({ cleanliness: 0, security: 6 })).toBeNull();
    expect(computeOverallRating({})).toBeNull();
    expect(computeOverallRating({ cleanliness: 3, wifi: 99 })).toBe(3);
  });

  it('rounds correctly to one decimal', () => {
    const overall = computeOverallRating({ cleanliness: 4, security: 3, water: 4 });
    expect(overall).toBeCloseTo(3.7, 1);
  });

  describe('roundedToStars / formatOverall', () => {
    it('clamps to 0-5 and rounds', () => {
      expect(roundedToStars(4.6)).toBe(5);
      expect(roundedToStars(4.4)).toBe(4);
      expect(roundedToStars(-5)).toBe(0);
      expect(roundedToStars(99)).toBe(5);
      expect(roundedToStars(null)).toBe(0);
      expect(roundedToStars(Number.NaN)).toBe(0);
    });

    it('formats to one decimal, or an em dash when unset', () => {
      expect(formatOverall(4.66)).toBe('4.7');
      expect(formatOverall(5)).toBe('5.0');
      expect(formatOverall(null)).toBe('—');
      expect(formatOverall(Number.NaN)).toBe('—');
    });
  });

  it('extracts only valid rating_* columns from a row', () => {
    const row = {
      id: 'x',
      rating_cleanliness: 4,
      rating_security: 9, // invalid -> skipped
      rating_water: 3,
      unrelated: 1,
    } as Record<string, unknown>;
    expect(categoryRatingsFromRow(row)).toEqual({ cleanliness: 4, water: 3 });
  });

  it('builds a flat rating_<key> payload for the API', () => {
    expect(categoryColumnsFromCategories({ wifi: 4, value: 2 })).toEqual({
      rating_wifi: 4,
      rating_value: 2,
    });
  });
});