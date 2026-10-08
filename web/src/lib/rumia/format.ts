import type { components } from '@/lib/api/schema';

type Unit = components['schemas']['UnitRead'];

export const PERIOD_LABEL: Record<string, string> = { night: 'night', week: 'week', month: 'month', semester: 'semester' };

/** "KSh 7,500" */
export function ksh(amount: number | null | undefined): string {
  if (amount === null || amount === undefined) return '';
  return `KSh ${Math.round(amount).toLocaleString('en-KE')}`;
}

/** "KSh 7,500 / month" — the period is always attached. */
export function pricePerPeriod(amount: number | null | undefined, period: string | null | undefined): string {
  if (amount === null || amount === undefined) return '';
  return `${ksh(amount)} / ${PERIOD_LABEL[period ?? 'month'] ?? period}`;
}

export const UNIT_LABEL: Record<string, string> = {
  single_room: 'Single room',
  double_room: 'Double room',
  shared_room: 'Shared room',
  bedsitter: 'Bedsitter',
  studio: 'Studio',
  one_bed: '1 bedroom',
  two_bed: '2 bedrooms',
  three_bed_plus: '3+ bedrooms',
  entire_home: 'Entire home',
  other: 'Room',
};

export const KIND_LABEL: Record<string, string> = {
  hostel: 'Hostel',
  apartment: 'Apartment',
  house: 'House',
  compound: 'Compound',
  room: 'Room',
};

export function unitLabel(unit: Pick<Unit, 'unit_kind' | 'label'>): string {
  return UNIT_LABEL[unit.unit_kind] && unit.unit_kind !== 'other' ? UNIT_LABEL[unit.unit_kind] : unit.label || 'Room';
}

export const UTILITY_LABEL: Record<string, string> = {
  water: 'Water',
  electricity: 'Electricity',
  wifi: 'Wi-Fi',
  hot_water: 'Hot water',
  cooking_gas: 'Cooking gas',
};

/** "Included: water, Wi-Fi" or an empty string. */
export function includedLine(utilities: string[] | undefined): string {
  const names = (utilities ?? []).map((u) => UTILITY_LABEL[u] ?? u);
  return names.length ? `Included: ${names.join(', ')}` : '';
}

/** Query-string for Explore from a plain filter object; empty values are dropped. */
export function exploreHref(filters: Record<string, string | number | string[] | undefined | null>, base = '/'): string {
  const sp = new URLSearchParams();
  for (const [k, v] of Object.entries(filters)) {
    if (v === undefined || v === null || v === '' || (Array.isArray(v) && v.length === 0)) continue;
    sp.set(k, Array.isArray(v) ? v.join(',') : String(v));
  }
  const q = sp.toString();
  return q ? `${base}?${q}` : base;
}
