import type { BnbStay } from './bnb-api';

/**
 * What a guest is looking for: place, dates, guests, kind. Lives in the URL (?where&in&out&guests&type) so a search
 * can be shared, survives a refresh, and travels from the results to a stay and on to the booking request.
 */
export interface StaySearch {
  where: string;
  checkIn: string | null; // yyyy-mm-dd
  checkOut: string | null;
  guests: number;
  type: StayType;
}

export type StayType = 'all' | 'entire' | 'room' | 'video' | 'long';

export const STAY_TYPES: Array<{ key: StayType; label: string }> = [
  { key: 'all', label: 'All stays' },
  { key: 'entire', label: 'Entire homes' },
  { key: 'room', label: 'Rooms' },
  { key: 'video', label: 'Video tours' },
  { key: 'long', label: 'Weekly & monthly' },
];

const ISO = /^\d{4}-\d{2}-\d{2}$/;

type Params = URLSearchParams | Record<string, string | string[] | undefined>;

function get(p: Params, k: string): string {
  if (p instanceof URLSearchParams) return p.get(k) ?? '';
  const v = p[k];
  return (Array.isArray(v) ? v[0] : v) ?? '';
}

export function parseSearch(p: Params): StaySearch {
  const checkIn = ISO.test(get(p, 'in')) ? get(p, 'in') : null;
  const checkOut = ISO.test(get(p, 'out')) ? get(p, 'out') : null;
  const type = STAY_TYPES.some((t) => t.key === get(p, 'type')) ? (get(p, 'type') as StayType) : 'all';
  return {
    where: get(p, 'where').trim().slice(0, 60),
    checkIn,
    checkOut: checkIn && checkOut && checkOut > checkIn ? checkOut : null,
    guests: Math.max(0, Math.min(50, parseInt(get(p, 'guests'), 10) || 0)),
    type,
  };
}

/** Query string for a search; empty parts are left out. */
export function searchQuery(s: Partial<StaySearch>): string {
  const q = new URLSearchParams();
  if (s.where) q.set('where', s.where);
  if (s.checkIn) q.set('in', s.checkIn);
  if (s.checkOut) q.set('out', s.checkOut);
  if (s.guests) q.set('guests', String(s.guests));
  if (s.type && s.type !== 'all') q.set('type', s.type);
  const str = q.toString();
  return str ? `?${str}` : '';
}

export function nightsBetween(checkIn: string | null, checkOut: string | null): number {
  if (!checkIn || !checkOut) return 0;
  const ms = Date.parse(`${checkOut}T00:00:00Z`) - Date.parse(`${checkIn}T00:00:00Z`);
  return ms > 0 ? Math.round(ms / 86400000) : 0;
}

/**
 * The same rule as the API (backend/app/features/stays/pricing.py): nightly, or the owner's weekly rate from 7 nights /
 * monthly from 30, never more than nightly; cleaning fee on top. Used to show totals on cards without a request each;
 * the booking page always asks the API.
 */
export function estimateTotal(stay: BnbStay, nights: number): { room: number; cleaning: number; total: number; basis: 'night' | 'week' | 'month' } | null {
  if (nights < 1) return null;
  const nightly = stay.price;
  const weekly = stay.bnb?.weekly_price ?? null;
  const monthly = stay.bnb?.monthly_price ?? null;
  let basis: 'night' | 'week' | 'month' = 'night';
  let room = nightly * nights;
  if (monthly && nights >= 30 && (monthly * nights) / 30 < room) {
    basis = 'month';
    room = (monthly * nights) / 30;
  } else if (weekly && nights >= 7 && (weekly * nights) / 7 < room) {
    basis = 'week';
    room = (weekly * nights) / 7;
  }
  room = Math.round(room);
  const cleaning = Math.round(stay.bnb?.cleaning_fee ?? 0);
  return { room, cleaning, total: room + cleaning, basis };
}

export function matchesSearch(stay: BnbStay, s: StaySearch): boolean {
  const where = s.where.toLowerCase();
  if (where && !`${stay.area ?? ''} ${stay.county ?? ''} ${stay.location} ${stay.title}`.toLowerCase().includes(where)) return false;
  const max = stay.bnb?.max_guests ?? 0;
  if (s.guests && max > 0 && max < s.guests) return false;
  const b = stay.bnb;
  const nights = nightsBetween(s.checkIn, s.checkOut);
  if (nights && b?.min_stay_nights && nights < b.min_stay_nights) return false;
  if (nights && b?.max_stay_nights && nights > b.max_stay_nights) return false;
  if (s.checkIn && b?.available_from && s.checkIn < b.available_from) return false;
  if (s.checkOut && b?.available_until && s.checkOut > b.available_until) return false;
  switch (s.type) {
    case 'entire':
      return (b?.listing_type ?? 'entire_place') === 'entire_place';
    case 'room':
      return b?.listing_type === 'private_room' || b?.listing_type === 'shared_space';
    case 'video':
      return !!stay.youtube_id;
    case 'long':
      return !!(b?.weekly_price || b?.monthly_price);
    default:
      return true;
  }
}

/** "12–15 Dec", "28 Dec – 2 Jan" */
export function shortRange(checkIn: string, checkOut: string): string {
  const a = new Date(`${checkIn}T00:00:00`);
  const b = new Date(`${checkOut}T00:00:00`);
  const month = (d: Date) => d.toLocaleDateString('en-KE', { month: 'short' });
  if (a.getMonth() === b.getMonth()) return `${a.getDate()}–${b.getDate()} ${month(b)}`;
  return `${a.getDate()} ${month(a)} – ${b.getDate()} ${month(b)}`;
}
