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

interface FilterActions {
  setGenders: (genders: string[]) => void;
  setAmenities: (amenities: string[]) => void;
  setRoomTypes: (roomTypes: string[]) => void;
  setPriceRange: (min: number | null, max: number | null) => void;
  setZones: (zones: string[]) => void;
  setMaxDistance: (distance: number | null) => void;
  setSortByNearest: (sort: boolean) => void;
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

export const useFilterStore = create<FilterState & FilterActions>()((set, get) => ({
  ...initialFilters,

  setGenders: (genders) => set({ genders }),
  setAmenities: (amenities) => set({ amenities }),
  setRoomTypes: (roomTypes) => set({ roomTypes }),
  setPriceRange: (min, max) => set({ minPrice: min, maxPrice: max }),
  setZones: (zones) => set({ zones }),
  setMaxDistance: (maxDistance) => set({ maxDistance }),
  setSortByNearest: (sortByNearest) => set({ sortByNearest }),

  reset: () => set(initialFilters),

  hydrateFromParams: (params) => {
    const genders = params.get('gender')?.split(',').filter(Boolean) ?? [];
    const amenities = params.get('amenities')?.split(',').filter(Boolean) ?? [];
    const roomTypes = params.get('roomType')?.split(',').filter(Boolean) ?? [];
    const minPrice = params.get('minPrice') ? Number(params.get('minPrice')) : null;
    const maxPrice = params.get('maxPrice') ? Number(params.get('maxPrice')) : null;
    const zones = params.get('zone')?.split(',').filter(Boolean) ?? [];
    const maxDistance = params.get('maxDistance') ? Number(params.get('maxDistance')) : null;
    const sortByNearest = params.get('sortByNearest') === 'true';
    set({ genders, amenities, roomTypes, minPrice, maxPrice, zones, maxDistance, sortByNearest });
  },

  toParams: () => {
    const { genders, amenities, roomTypes, minPrice, maxPrice, zones, maxDistance, sortByNearest } = get();
    const params = new URLSearchParams();
    if (genders.length) params.set('gender', genders.join(','));
    if (amenities.length) params.set('amenities', amenities.join(','));
    if (roomTypes.length) params.set('roomType', roomTypes.join(','));
    if (minPrice !== null) params.set('minPrice', String(minPrice));
    if (maxPrice !== null) params.set('maxPrice', String(maxPrice));
    if (zones.length) params.set('zone', zones.join(','));
    if (maxDistance !== null) params.set('maxDistance', String(maxDistance));
    if (sortByNearest) params.set('sortByNearest', 'true');
    return params;
  },
}));

