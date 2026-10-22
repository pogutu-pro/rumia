'use client';

import { create } from 'zustand';

export interface FilterState {
  genders: string[];
  amenities: string[];
  roomTypes: string[];
  minPrice: number | null;
  maxPrice: number | null;
  zones: string[];
  maxDistance: number | null;
  sortByNearest: boolean;
}

/** Explore-only refinements (kept out of FilterState, which other pages build by hand). */
export type ExploreSort = 'recommended' | 'price_asc' | 'price_desc' | 'nearest' | 'newest';
export interface ExploreRefinements {
  /** 'hostel' | 'apartment'; null = both. Apartments are a kind of place on Explore, not a separate product. */
  propertyType: string | null;
  bathroom: 'private' | 'shared' | null;
  /** 'walk' = walking distance (up to ~10 min); 'near' = within about 2 km. */
  distance: 'walk' | 'near' | null;
  sort: ExploreSort;
}

const EXPLORE_SORTS: ExploreSort[] = ['recommended', 'price_asc', 'price_desc', 'nearest', 'newest'];

interface FilterActions {
  setGenders: (genders: string[]) => void;
  setAmenities: (amenities: string[]) => void;
  setRoomTypes: (roomTypes: string[]) => void;
  setPriceRange: (min: number | null, max: number | null) => void;
  setZones: (zones: string[]) => void;
  setMaxDistance: (distance: number | null) => void;
  setSortByNearest: (sort: boolean) => void;
  setPropertyType: (type: string | null) => void;
  setBathroom: (bathroom: ExploreRefinements['bathroom']) => void;
  setDistance: (distance: ExploreRefinements['distance']) => void;
  setSort: (sort: ExploreSort) => void;
  /** Replace every filter at once (the Explore panel applies its draft this way). */
  applyAll: (filters: FilterState & ExploreRefinements) => void;
  reset: () => void;
  hydrateFromParams: (params: URLSearchParams) => void;
  toParams: () => URLSearchParams;
}

const initialFilters: FilterState = {
  genders: [],
  amenities: [],
  roomTypes: [],
  minPrice: null,
  maxPrice: null,
  zones: [],
  maxDistance: null,
  sortByNearest: false,
};

const initialRefinements: ExploreRefinements = { propertyType: null, bathroom: null, distance: null, sort: 'recommended' };

export const useFilterStore = create<FilterState & ExploreRefinements & FilterActions>()((set, get) => ({
  ...initialFilters,
  ...initialRefinements,

  setGenders: (genders) => set({ genders }),
  setAmenities: (amenities) => set({ amenities }),
  setRoomTypes: (roomTypes) => set({ roomTypes }),
  setPriceRange: (min, max) => set({ minPrice: min, maxPrice: max }),
  setZones: (zones) => set({ zones }),
  setMaxDistance: (maxDistance) => set({ maxDistance }),
  setSortByNearest: (sortByNearest) => set({ sortByNearest }),
  setPropertyType: (propertyType) => set({ propertyType }),
  setBathroom: (bathroom) => set({ bathroom }),
  setDistance: (distance) => set({ distance }),
  setSort: (sort) => set({ sort }),
  applyAll: (filters) => set(filters),

  reset: () => set({ ...initialFilters, ...initialRefinements }),

  hydrateFromParams: (params) => {
    const genders = params.get('gender')?.split(',').filter(Boolean) ?? [];
    const amenities = params.get('amenities')?.split(',').filter(Boolean) ?? [];
    const roomTypes = params.get('roomType')?.split(',').filter(Boolean) ?? [];
    const minPrice = params.get('minPrice') ? Number(params.get('minPrice')) : null;
    const maxPrice = params.get('maxPrice') ? Number(params.get('maxPrice')) : null;
    const zones = params.get('zone')?.split(',').filter(Boolean) ?? [];
    const maxDistance = params.get('maxDistance') ? Number(params.get('maxDistance')) : null;
    const sortByNearest = params.get('sortByNearest') === 'true';
    const type = params.get('type');
    const propertyType = type === 'hostel' || type === 'apartment' ? type : null;
    const bath = params.get('bath');
    const bathroom = bath === 'private' || bath === 'shared' ? bath : null;
    const dist = params.get('dist');
    const distance = dist === 'walk' || dist === 'near' ? dist : null;
    const sortParam = params.get('sort') as ExploreSort | null;
    const sort = sortParam && EXPLORE_SORTS.includes(sortParam) ? sortParam : 'recommended';
    set({ genders, amenities, roomTypes, minPrice, maxPrice, zones, maxDistance, sortByNearest, propertyType, bathroom, distance, sort });
  },

  toParams: () => {
    const { genders, amenities, roomTypes, minPrice, maxPrice, zones, maxDistance, sortByNearest, propertyType, bathroom, distance, sort } = get();
    const params = new URLSearchParams();
    if (genders.length) params.set('gender', genders.join(','));
    if (amenities.length) params.set('amenities', amenities.join(','));
    if (roomTypes.length) params.set('roomType', roomTypes.join(','));
    if (minPrice !== null) params.set('minPrice', String(minPrice));
    if (maxPrice !== null) params.set('maxPrice', String(maxPrice));
    if (zones.length) params.set('zone', zones.join(','));
    if (maxDistance !== null) params.set('maxDistance', String(maxDistance));
    if (sortByNearest) params.set('sortByNearest', 'true');
    if (propertyType) params.set('type', propertyType);
    if (bathroom) params.set('bath', bathroom);
    if (distance) params.set('dist', distance);
    if (sort !== 'recommended') params.set('sort', sort);
    return params;
  },
}));

