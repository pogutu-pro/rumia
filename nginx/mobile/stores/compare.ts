import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';

const STORAGE_KEY = 'rumia-compare';
const TTL_MS = 24 * 60 * 60 * 1000; // 24 hours
const MAX_SELECTIONS = 2;

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
  hydrateFromStorage: () => Promise<void>;
}

async function loadFromStorage(): Promise<StoredCompareState | null> {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed: StoredCompareState = JSON.parse(raw);
    if (Date.now() - parsed.selectedAt > TTL_MS) {
      await AsyncStorage.removeItem(STORAGE_KEY);
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

async function saveToStorage(state: StoredCompareState) {
  try {
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // Storage full or unavailable — silently degrade
  }
}

export const useCompareStore = create<CompareState>((set, get) => ({
  hydrated: false,
  selectedIds: [],
  selections: {},
  selectedAt: 0,

  hydrateFromStorage: async () => {
    const stored = await loadFromStorage();
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

  addSelection: (selection) => {
    const { selectedIds, selections } = get();

    if (selectedIds.includes(selection.id)) {
      return { ok: false, reason: 'already_selected' };
    }

    if (selectedIds.length >= MAX_SELECTIONS) {
      return { ok: false, reason: 'max_reached' };
    }

    const nextIds = [...selectedIds, selection.id];
    const nextSelections = { ...selections, [selection.id]: selection };
    const nextAt = Date.now();

    set({ selectedIds: nextIds, selections: nextSelections, selectedAt: nextAt });
    void saveToStorage({ selectedIds: nextIds, selections: nextSelections, selectedAt: nextAt });
    return { ok: true };
  },

  removeSelection: (id) => {
    const { selectedIds, selections, selectedAt } = get();
    const nextIds = selectedIds.filter((i) => i !== id);
    const nextSelections = { ...selections };
    delete nextSelections[id];

    set({ selectedIds: nextIds, selections: nextSelections });
    if (nextIds.length === 0) {
      void AsyncStorage.removeItem(STORAGE_KEY).catch(() => {});
    } else {
      void saveToStorage({ selectedIds: nextIds, selections: nextSelections, selectedAt });
    }
  },

  clearSelection: () => {
    set({ selectedIds: [], selections: {}, selectedAt: 0 });
    void AsyncStorage.removeItem(STORAGE_KEY).catch(() => {});
  },

  isSelected: (id) => get().selectedIds.includes(id),
  getCount: () => get().selectedIds.length,
}));