/**
 * DeKUT Hostel Area Definitions
 * GPS coordinates for each official hostel area around Dedan Kimathi University of Technology
 */

export interface AreaCoordinates {
  name: string;
  latitude: number;
  longitude: number;
}

export const DEKUT_AREAS: Record<string, AreaCoordinates> = {
  'Near Gate A': {
    name: 'Near Gate A',
    latitude: -0.397509,
    longitude: 36.9566783,
  },
  'Near Gate B': {
    name: 'Near Gate B',
    latitude: -0.3975,
    longitude: 36.9602,
  },
  'Nyeri View': {
    name: 'Nyeri View',
    latitude: -0.3963,
    longitude: 36.95,
  },
  'Kahawa Ridge': {
    name: 'Kahawa Ridge',
    latitude: -0.401,
    longitude: 36.954,
  },
  'Embassy Area': {
    name: 'Embassy Area',
    latitude: -0.3721,
    longitude: 36.9325,
  },
  Nyaribo: {
    name: 'Nyaribo',
    latitude: -0.3785,
    longitude: 36.981,
  },
  Boma: {
    name: 'Boma',
    latitude: -0.4005,
    longitude: 36.9645,
  },
};

/**
 * Approximate walking distance from DeKUT main gate to each area.
 * Used in the book-tour location picker.
 */
const AREA_DISTANCES: Record<string, string> = {
  'Near Gate A': '~2 min walk',
  'Near Gate B': '~3 min walk',
  Boma: '~5 min walk',
  'Kahawa Ridge': '~8 min walk',
  'Nyeri View': '~10 min walk',
  Nyaribo: '~15 min walk',
  'Embassy Area': '~20 min walk',
};

export const AREA_OPTIONS = Object.values(DEKUT_AREAS).map((area) => ({
  value: area.name,
  label: area.name,
  distance: AREA_DISTANCES[area.name] || '',
}));

export const DISTANCE_CATEGORY_OPTIONS = [
  { value: 'walking-500m', label: 'Walking distance (under 500m)' },
  { value: '5-10min', label: '5–10 minute walk' },
  { value: '1-2km', label: '1–2 kilometres' },
  { value: '3km', label: 'About 3 kilometres' },
  { value: 'over-3km', label: 'Over 3 kilometres' },
];

/**
 * Get badge display text for distance category
 */
export const getDistanceBadgeText = (
  distanceCategory: string | null | undefined,
): string | null => {
  if (!distanceCategory) return null;

  const mapping: Record<string, string> = {
    'walking-500m': 'Walking distance',
    '5-10min': '5–10 min walk',
    '1-2km': '1–2 km',
    '3km': '3 km away',
    'over-3km': 'Over 3 km',
  };

  return mapping[distanceCategory] || null;
};
