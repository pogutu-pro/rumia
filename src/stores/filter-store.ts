'use client';

import { create } from 'zustand';

export interface FilterState {
  genders: string[];
  amenities: string[];
  roomTypes: string[];
  minPrice: number | null;
  maxPrice: number | null;
  zones: string[];
}

interface FilterActions {
  setGenders: (genders: string[]) => void;
  setAmenities: (amenities: string[]) => void;
  setRoomTypes: (roomTypes: string[]) => void;
  setPriceRange: (min: number | null, max: number | null) => void;
  setZones: (zones: string[]) => void;
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
};

export const useFilterStore = create<FilterState & FilterActions>()((set, get) => ({
  ...initialFilters,

  setGenders: (genders) => set({ genders }),
  setAmenities: (amenities) => set({ amenities }),
  setRoomTypes: (roomTypes) => set({ roomTypes }),
  setPriceRange: (min, max) => set({ minPrice: min, maxPrice: max }),
  setZones: (zones) => set({ zones }),

  reset: () => set(initialFilters),

  hydrateFromParams: (params) => {
    const genders = params.get('gender')?.split(',').filter(Boolean) ?? [];
    const amenities = params.get('amenities')?.split(',').filter(Boolean) ?? [];
    const roomTypes = params.get('roomType')?.split(',').filter(Boolean) ?? [];
    const minPrice = params.get('minPrice') ? Number(params.get('minPrice')) : null;
    const maxPrice = params.get('maxPrice') ? Number(params.get('maxPrice')) : null;
    const zones = params.get('zone')?.split(',').filter(Boolean) ?? [];
    set({ genders, amenities, roomTypes, minPrice, maxPrice, zones });
  },

  toParams: () => {
    const { genders, amenities, roomTypes, minPrice, maxPrice, zones } = get();
    const params = new URLSearchParams();
    if (genders.length) params.set('gender', genders.join(','));
    if (amenities.length) params.set('amenities', amenities.join(','));
    if (roomTypes.length) params.set('roomType', roomTypes.join(','));
    if (minPrice !== null) params.set('minPrice', String(minPrice));
    if (maxPrice !== null) params.set('maxPrice', String(maxPrice));
    if (zones.length) params.set('zone', zones.join(','));
    return params;
  },
}));
