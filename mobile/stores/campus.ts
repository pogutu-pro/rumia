import { create } from 'zustand';
import { DEFAULT_CAMPUS_SLUG } from '../lib/api/campuses';

interface CampusPreference {
  id: string;
  name: string;
  slug: string;
}

interface CampusState {
  selectedCampusId: string | null;
  selectedCampusName: string;
  selectedCampusSlug: string;
  setSelectedCampus: (campus: CampusPreference) => void;
}

export const useCampusStore = create<CampusState>((set) => ({
  selectedCampusId: null,
  selectedCampusName: 'DeKUT Main Campus',
  selectedCampusSlug: DEFAULT_CAMPUS_SLUG,
  setSelectedCampus: (campus) =>
    set({
      selectedCampusId: campus.id,
      selectedCampusName: campus.name,
      selectedCampusSlug: campus.slug,
    }),
}));
