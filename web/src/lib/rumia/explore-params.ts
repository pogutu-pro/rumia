import { exploreHref } from './format';

/** Everything Explore understands in the URL. Arrays are comma-separated in the query string. */
export interface ExploreFilters {
  q: string;
  mode: 'monthly' | 'nightly';
  place: string[];
  kind: string;
  unit_kind: string[];
  min_price: string;
  max_price: string;
  amenities: string[];
  near: string;
  has_video: string;
  gender: string;
  sort: string;
}

type Raw = Record<string, string | string[] | undefined>;

const csv = (v: string | string[] | undefined): string[] =>
  (Array.isArray(v) ? v.join(',') : (v ?? ''))
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
const one = (v: string | string[] | undefined): string => (Array.isArray(v) ? (v[0] ?? '') : (v ?? '')).trim();

export function parseFilters(raw: Raw): ExploreFilters {
  const num = (v: string) => (v && Number.isFinite(Number(v)) && Number(v) >= 0 ? String(Math.round(Number(v))) : '');
  return {
    q: one(raw.q).slice(0, 200),
    mode: one(raw.mode) === 'nightly' ? 'nightly' : 'monthly',
    place: csv(raw.place),
    kind: ['hostel', 'apartment', 'house', 'compound', 'room'].includes(one(raw.kind)) ? one(raw.kind) : '',
    unit_kind: csv(raw.unit_kind),
    min_price: num(one(raw.min_price)),
    max_price: num(one(raw.max_price)),
    amenities: csv(raw.amenities),
    near: one(raw.near),
    has_video: one(raw.has_video) === 'true' ? 'true' : '',
    gender: ['women', 'men'].includes(one(raw.gender)) ? one(raw.gender) : '',
    sort: ['best', 'newest', 'price_asc', 'price_desc'].includes(one(raw.sort)) ? one(raw.sort) : '',
  };
}

/** Query for GET /discovery/search. */
export function toApiQuery(f: ExploreFilters, extra: { limit?: number; cursor?: string } = {}) {
  return {
    q: f.q || undefined,
    mode: f.mode,
    place: f.place.length ? f.place.join(',') : undefined,
    kind: (f.kind || undefined) as 'hostel' | 'apartment' | 'house' | 'compound' | 'room' | undefined,
    unit_kind: f.unit_kind.length ? f.unit_kind.join(',') : undefined,
    min_price: f.min_price ? Number(f.min_price) : undefined,
    max_price: f.max_price ? Number(f.max_price) : undefined,
    amenities: f.amenities.length ? f.amenities.join(',') : undefined,
    near: f.near || undefined,
    has_video: f.has_video ? true : undefined,
    gender: (f.gender || undefined) as 'women' | 'men' | undefined,
    sort: (f.sort || undefined) as 'best' | 'newest' | 'price_asc' | 'price_desc' | undefined,
    limit: extra.limit ?? 20,
    cursor: extra.cursor,
  };
}

/** The URL for a set of filters. Default values (monthly, best match) are left out to keep links short. */
export function filtersHref(f: Partial<ExploreFilters>): string {
  return exploreHref({
    q: f.q,
    mode: f.mode === 'nightly' ? 'nightly' : undefined,
    place: f.place,
    kind: f.kind,
    unit_kind: f.unit_kind,
    min_price: f.min_price,
    max_price: f.max_price,
    amenities: f.amenities,
    near: f.near,
    has_video: f.has_video,
    gender: f.gender,
    sort: f.sort && f.sort !== 'best' ? f.sort : undefined,
  });
}

export interface Chip {
  key: string;
  value?: string;
  label: string;
}

interface Named {
  slug: string;
  name: string;
}

const UNIT_NAMES: Record<string, string> = {
  bedsitter: 'Bedsitter', studio: 'Studio', one_bed: '1 bedroom', two_bed: '2 bedrooms', three_bed_plus: '3+ bedrooms',
  single_room: 'Single room', double_room: 'Double room', shared_room: 'Shared room', entire_home: 'Entire home',
};
const AMENITY_NAMES: Record<string, string> = { wifi: 'Wi-Fi', parking: 'Parking', water: 'Water', security: 'Security', furnished: 'Furnished' };

/** The removable chips shown under the search box, built from the filters actually applied. */
export function chipsFor(applied: Partial<ExploreFilters>, places: Named[], landmarks: Named[]): Chip[] {
  const chips: Chip[] = [];
  if (applied.mode === 'nightly') chips.push({ key: 'mode', label: 'Per night' });
  for (const slug of applied.place ?? []) chips.push({ key: 'place', value: slug, label: places.find((p) => p.slug === slug)?.name ?? slug });
  if (applied.near) chips.push({ key: 'near', label: `Near ${landmarks.find((l) => l.slug === applied.near)?.name ?? applied.near}` });
  if (applied.kind) chips.push({ key: 'kind', label: applied.kind.charAt(0).toUpperCase() + applied.kind.slice(1) });
  for (const u of applied.unit_kind ?? []) chips.push({ key: 'unit_kind', value: u, label: UNIT_NAMES[u] ?? u });
  if (applied.min_price) chips.push({ key: 'min_price', label: `From KSh ${Number(applied.min_price).toLocaleString('en-KE')}` });
  if (applied.max_price) chips.push({ key: 'max_price', label: `Under KSh ${Number(applied.max_price).toLocaleString('en-KE')}` });
  for (const a of applied.amenities ?? []) chips.push({ key: 'amenities', value: a, label: AMENITY_NAMES[a] ?? a });
  if (applied.has_video) chips.push({ key: 'has_video', label: 'Has video' });
  if (applied.gender) chips.push({ key: 'gender', label: applied.gender === 'women' ? 'Women only' : 'Men only' });
  return chips;
}

/** Filters with one chip removed. */
export function withoutChip(f: ExploreFilters, chip: Chip): ExploreFilters {
  const next: ExploreFilters = { ...f, place: [...f.place], unit_kind: [...f.unit_kind], amenities: [...f.amenities] };
  switch (chip.key) {
    case 'place': next.place = next.place.filter((v) => v !== chip.value); break;
    case 'unit_kind': next.unit_kind = next.unit_kind.filter((v) => v !== chip.value); break;
    case 'amenities': next.amenities = next.amenities.filter((v) => v !== chip.value); break;
    case 'mode': next.mode = 'monthly'; break;
    default: (next as unknown as Record<string, string>)[chip.key] = '';
  }
  return next;
}
