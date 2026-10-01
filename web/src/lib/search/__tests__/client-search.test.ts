import { clientSearch } from '../client-search';
import type { SearchListing, CombinedFilters } from '../types';

function listing(overrides: Partial<SearchListing> & { id: string; title: string }): SearchListing {
  return {
    description: '',
    price: 5000,
    location: '',
    slug: null,
    county: null,
    area: null,
    listing_images: [],
    agents: null,
    ...overrides,
  };
}

function search(listings: SearchListing[], searchText: string) {
  const filters: CombinedFilters = {
    searchText,
    genders: [],
    amenities: [],
    roomTypes: [],
    minPrice: null,
    maxPrice: null,
    zones: [],
  };
  return clientSearch(listings, filters, listings.length, 0).listings.map((l) => l.title);
}

// ── Fixtures modeled on the live production dataset ──────────────────────────

const fixtures = [
  listing({
    id: 'new-tamaal',
    title: 'NEW TAMAAL HOSTEL',
    sort_position: 1,
    gender: 'mixed',
    description: 'Bedsitter near Dekut',
  }),
  listing({
    id: 'female-internal',
    title: 'FEMALE INTERNAL HOSTELS',
    sort_position: 2,
    gender: 'female',
    description: 'Ladies only hostel near campus',
  }),
  listing({
    id: 'solid4',
    title: 'SOLID 4',
    sort_position: 3,
    gender: 'male',
    description: 'Gents hostel',
  }),
  listing({
    id: 'mnm',
    title: 'MNM',
    sort_position: 7,
    gender: 'female',
    description: 'Ladies only hostel near dedan kimathi university of technology boma',
  }),
  listing({
    id: 'grace',
    title: 'Grace Hostels',
    sort_position: 9,
    gender: 'mixed',
    description: 'Near gate A',
  }),
  listing({
    id: 'maisha',
    title: 'MAISHA HOSTEL',
    sort_position: 14,
    gender: 'mixed',
    description: 'Boma near maisha',
  }),
  listing({
    id: 'samrice',
    title: 'SAMRICE HOSTELS',
    sort_position: 17,
    gender: 'mixed',
    description: 'Self-contained rooms',
  }),
  listing({
    id: 'baraka',
    title: 'BARAKA',
    sort_position: 20,
    gender: 'mixed',
    description: 'All rooms are same size and of good quality',
  }),
  listing({
    id: 'kaka',
    title: 'Kaka Estate Bedsitter',
    sort_position: 24,
    gender: 'mixed',
    description: 'A spacious bedsitter with a private washroom',
    specific_location: "King'ong'o",
  }),
  listing({
    id: 'sunrise',
    title: 'SUNRISE HOSTEL',
    sort_position: 31,
    gender: 'mixed',
    description: 'Rooms near Dekut gate B',
  }),
  listing({
    id: 'kimathi',
    title: 'KIMATHI STUDENT CENTRE HOSTEL(GREENS)',
    sort_position: 38,
    gender: 'mixed',
    description: 'Student centre near the university',
  }),
  listing({
    id: 'new-sunrise',
    title: 'New Sunrise',
    sort_position: 49,
    gender: 'mixed',
    description: 'Fresh rooms',
  }),
];

describe('clientSearch ranking', () => {
  it('ranks an exact name match first', () => {
    const results = search(fixtures, 'samrice');
    expect(results[0]).toBe('SAMRICE HOSTELS');
  });

  it('keeps the exact-name match on top even when a generic word is added', () => {
    // Regression: "samrice hostel" used to show MAISHA above SAMRICE.
    const results = search(fixtures, 'samrice hostel');
    expect(results[0]).toBe('SAMRICE HOSTELS');
    expect(results).not.toContain('MAISHA HOSTEL');
  });

  it('is stable across partial keystrokes while typing a name', () => {
    for (const q of ['sa', 'sam', 'samr', 'samri', 'samrice']) {
      const results = search(fixtures, q);
      expect(results[0]).toBe('SAMRICE HOSTELS');
    }
  });

  it('ranks the listing literally named like the query first', () => {
    const results = search(fixtures, 'kimathi');
    expect(results[0]).toBe('KIMATHI STUDENT CENTRE HOSTEL(GREENS)');
    expect(results.indexOf('MNM')).toBeGreaterThan(results.indexOf('KIMATHI STUDENT CENTRE HOSTEL(GREENS)'));
  });

  it('finds a bedsitter query without depending on room_type_enum', () => {
    const results = search(fixtures, 'bedsitter');
    expect(results).toContain('Kaka Estate Bedsitter');
  });

  it('parses gender words into a structured filter', () => {
    const results = search(fixtures, 'girls hostel');
    expect(results[0]).toBe('FEMALE INTERNAL HOSTELS');
    expect(results).not.toContain('MALE INTERNAL HOSTELS');
  });

  it('falls back to fuzzy matching for typos', () => {
    const results = search(fixtures, 'samice');
    expect(results[0]).toBe('SAMRICE HOSTELS');
  });

  it('keeps admin sort order when there is no text query', () => {
    const results = search(fixtures, '');
    expect(results).toEqual([
      'NEW TAMAAL HOSTEL',
      'FEMALE INTERNAL HOSTELS',
      'SOLID 4',
      'MNM',
      'Grace Hostels',
      'MAISHA HOSTEL',
      'SAMRICE HOSTELS',
      'BARAKA',
      'Kaka Estate Bedsitter',
      'SUNRISE HOSTEL',
      'KIMATHI STUDENT CENTRE HOSTEL(GREENS)',
      'New Sunrise',
    ]);
  });

  it('uses the area / specific location when the name does not match', () => {
    const results = search(fixtures, "king'ong'o");
    expect(results[0]).toBe('Kaka Estate Bedsitter');
  });

  it('does not let an unrelated listing outrank a fuzzy name hit', () => {
    const results = search(fixtures, 'sunshine');
    expect(results[0]).toBe('SUNRISE HOSTEL');
  });
});
