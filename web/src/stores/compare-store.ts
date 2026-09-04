'use client';

import { create } from 'zustand';

const STORAGE_KEY = 'rumia-compare';
const TTL_MS = 24 * 60 * 60 * 1000; // 24 hours

function getMaxSelections(): number {
  if (typeof window === 'undefined') return 4;
  return window.innerWidth < 768 ? 2 : 4;
}

export interface CompareSelection {
  id: string;
  title: string;
  price: number;
  price_single?: number | null;
  price_sharing?: number | null;
  imageUrl?: string;
  slug?: string | null;
  county?: string | null;
  area?: string | null;
  agentName?: string | null;
  agentPhone?: string | null;
  agentWhatsapp?: string | null;
  // Amenities & features
  amenities?: string[] | null;
  roomType?: string | null;
  roomTypeEnum?: string | null;
  bathroomType?: string | null;
  distanceCategory?: string | null;
  distanceToCampus?: string | null;
  gender?: string | null;
  // Utilities
  wifiIncluded?: boolean | null;
  waterIncluded?: boolean | null;
  electricityIncluded?: boolean | null;
  securityType?: string | null;
  // Location
  specificLocation?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  // Payment
  mpesaDetails?: string | null;
  // Room type structured fields
  deposit?: number | null;
  furnishingItems?: string[] | null;
  roomTypeLabel?: string | null;
}

interface StoredCompareState {
  selectedIds: string[];
  selections: Record<string, CompareSelection>;
  selectedAt: number;
}

interface CompareState {
  hydrated: boolean;
  selectedIds: string[];
  selections: Record<string, CompareSelection>;
  selectedAt: number;
  addSelection: (selection: CompareSelection) => { ok: boolean; reason?: string };
  removeSelection: (id: string) => void;
  clearSelection: () => void;
  isSelected: (id: string) => boolean;
  getCount: () => number;
  hydrateFromStorage: () => void;
  loadFromIds: (ids: string[], remoteSelections: Record<string, CompareSelection>) => void;
}

function loadFromStorage(): StoredCompareState | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed: StoredCompareState & { selectedAt: number } = JSON.parse(raw);
    if (Date.now() - parsed.selectedAt > TTL_MS) {
      localStorage.removeItem(STORAGE_KEY);
      return null;
    }
    return parsed;
  } catch {
    localStorage.removeItem(STORAGE_KEY);
    return null;
  }
}

function saveToStorage(state: { selectedIds: string[]; selections: Record<string, CompareSelection>; selectedAt: number }) {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // Storage full or unavailable — silently degrade
  }
}

export const useCompareStore = create<CompareState>()((set, get) => ({
  hydrated: false,
  selectedIds: [],
  selections: {},
  selectedAt: 0,

  hydrateFromStorage: () => {
    const stored = loadFromStorage();
    if (stored) {
      set({
        hydrated: true,
        selectedIds: stored.selectedIds,
        selections: stored.selections,
        selectedAt: stored.selectedAt,
      });
    } else {
      set({ hydrated: true });
    }
  },

  loadFromIds: (ids, remoteSelections) => {
    const validIds = ids.filter((id) => remoteSelections[id]).slice(0, getMaxSelections());
    const nextSelections: Record<string, CompareSelection> = {};
    validIds.forEach((id) => {
      nextSelections[id] = remoteSelections[id];
    });
    const nextAt = Date.now();
    set({ hydrated: true, selectedIds: validIds, selections: nextSelections, selectedAt: nextAt });
    saveToStorage({ selectedIds: validIds, selections: nextSelections, selectedAt: nextAt });
  },

  addSelection: (selection) => {
    const { selectedIds, selections } = get();

    if (selectedIds.includes(selection.id)) {
      return { ok: false, reason: 'already_selected' };
    }

    if (selectedIds.length >= getMaxSelections()) {
      return { ok: false, reason: 'max_reached' };
    }

    const nextIds = [...selectedIds, selection.id];
    const nextSelections = { ...selections, [selection.id]: selection };
    const nextAt = Date.now();

    set({ selectedIds: nextIds, selections: nextSelections, selectedAt: nextAt });
    saveToStorage({ selectedIds: nextIds, selections: nextSelections, selectedAt: nextAt });
    return { ok: true };
  },

  removeSelection: (id) => {
    const { selectedIds, selections } = get();
    const nextIds = selectedIds.filter((i) => i !== id);
    const nextSelections = { ...selections };
    delete nextSelections[id];

    set({ selectedIds: nextIds, selections: nextSelections });
    saveToStorage({ selectedIds: nextIds, selections: nextSelections, selectedAt: get().selectedAt });

    if (nextIds.length === 0) {
      if (typeof window !== 'undefined') localStorage.removeItem(STORAGE_KEY);
    }
  },

  clearSelection: () => {
    set({ selectedIds: [], selections: {}, selectedAt: 0 });
    if (typeof window !== 'undefined') localStorage.removeItem(STORAGE_KEY);
  },

  isSelected: (id) => get().selectedIds.includes(id),
  getCount: () => get().selectedIds.length,
}));
