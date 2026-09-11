'use client';

import { create } from 'zustand';

export interface BnbFilterState {
  amenities: string[];
  minPrice: number | null;
  maxPrice: number | null;
  locations: string[]; // area/town filter
}

interface BnbFilterActions {
  setAmenities: (v: string[]) => void;
  setPriceRange: (min: number | null, max: number | null) => void;
  setLocations: (v: string[]) => void;
  reset: () => void;
  hydrateFromParams: (params: URLSearchParams) => void;
  toParams: () => URLSearchParams;
}

const initial: BnbFilterState = {
  amenities: [],
  minPrice: null,
  maxPrice: null,
  locations: [],
};

export const useBnbFilterStore = create<BnbFilterState & BnbFilterActions>()(
  (set, get) => ({
    ...initial,

    setAmenities: (amenities) => set({ amenities }),
    setPriceRange: (min, max) => set({ minPrice: min, maxPrice: max }),
    setLocations: (locations) => set({ locations }),

    reset: () => set(initial),

    hydrateFromParams: (params) => {
      const amenities = params.get('amenities')?.split(',').filter(Boolean) ?? [];
      const minPrice = params.get('minPrice') ? Number(params.get('minPrice')) : null;
      const maxPrice = params.get('maxPrice') ? Number(params.get('maxPrice')) : null;
      const locations = params.get('location')?.split(',').filter(Boolean) ?? [];
      set({ amenities, minPrice, maxPrice, locations });
    },

    toParams: () => {
      const { amenities, minPrice, maxPrice, locations } = get();
      const params = new URLSearchParams();
      if (amenities.length) params.set('amenities', amenities.join(','));
      if (minPrice !== null) params.set('minPrice', String(minPrice));
      if (maxPrice !== null) params.set('maxPrice', String(maxPrice));
      if (locations.length) params.set('location', locations.join(','));
      return params;
    },
  }),
);
