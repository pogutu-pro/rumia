export interface CampusAreaOption {
  id?: string;
  name: string;
  slug?: string | null;
  full_search_price?: number | null;
  distance_category?: string | null;
}

export function normalizeCampusAreaSelection(
  value: string | null | undefined,
  availableAreas: Array<CampusAreaOption | null | undefined>,
): string | null {
  const trimmed = value?.trim();
  if (!trimmed) return null;

  const canonical = availableAreas.find((area) => {
    if (!area?.name) return false;
    return area.name.trim().toLowerCase() === trimmed.toLowerCase();
  });

  return canonical?.name?.trim() || null;
}
