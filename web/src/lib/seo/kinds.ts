/**
 * The kinds of place that get their own search-friendly page under /{market} and /{market}/{place}.
 * `query` is what the discovery API is asked for; the wording follows how people in Kenya search.
 */
export interface KindPage {
  slug: string;
  /** Plural noun used in titles: "Student hostels". */
  label: string;
  /** Lower-case phrase used in sentences: "student hostels". */
  phrase: string;
  query: { kind?: string; unit_kind?: string; mode?: 'monthly' | 'nightly' };
  /** What a visitor gets, in one clause, for the page intro. */
  blurb: string;
}

export const KIND_PAGES: KindPage[] = [
  { slug: 'student-hostels', label: 'Student hostels', phrase: 'student hostels', query: { kind: 'hostel' },
    blurb: 'Hostels near campus with monthly rent, move-in costs and walking time.' },
  { slug: 'bedsitters', label: 'Bedsitters', phrase: 'bedsitters', query: { unit_kind: 'bedsitter' },
    blurb: 'Self-contained bedsitters with the monthly rent and the deposit up front.' },
  { slug: 'single-rooms', label: 'Single rooms', phrase: 'single rooms', query: { unit_kind: 'single' },
    blurb: 'Single rooms to rent, with the real monthly cost.' },
  { slug: 'apartments', label: 'Apartments', phrase: 'apartments', query: { kind: 'apartment' },
    blurb: 'One, two and three bedroom apartments to rent.' },
  { slug: 'short-stays', label: 'Airbnb and short stays', phrase: 'Airbnb and short stays', query: { mode: 'nightly' },
    blurb: 'Furnished places to book by the night, priced per night.' },
];

export const KIND_BY_SLUG: Record<string, KindPage> = Object.fromEntries(KIND_PAGES.map((k) => [k.slug, k]));

/** Pages with fewer places than this are `noindex` and left out of the sitemap: thin pages dilute the good ones. */
export const MIN_INDEXABLE = 3;
