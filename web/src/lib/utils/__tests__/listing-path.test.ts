import { listingPath, slugifySegment } from '../listing-path';

describe('listingPath', () => {
  it('lowercases and hyphenates segments', () => {
    expect(listingPath({ county: 'nyeri', area: 'Near Gate A', slug: 'blessed-court-1a2b' })).toBe(
      '/nyeri/student-hostels/near-gate-a/blessed-court-1a2b',
    );
  });

  it('keeps the already-clean case unchanged', () => {
    expect(listingPath({ county: 'nyeri', area: 'boma', slug: 'baraka-boma' })).toBe('/nyeri/student-hostels/boma/baraka-boma');
  });

  it('uses the short link when the county or area is unknown', () => {
    expect(listingPath({ slug: 'x' })).toBe('/p/x');
    expect(listingPath({ county: '???', area: '', slug: 'x' })).toBe('/p/x');
  });

  it('puts the type in the path', () => {
    expect(listingPath({ county: 'nyeri', area: 'Kamakwa', slug: 'oserian-1', property_type: 'apartment' })).toBe('/nyeri/apartments/kamakwa/oserian-1');
    expect(listingPath({ county: 'nyeri', area: 'Kamakwa', slug: 'oserian-villa', property_type: 'short_stay' })).toBe('/nyeri/short-stays/kamakwa/oserian-villa');
  });

  it("handles apostrophes and punctuation (King'ong'o)", () => {
    expect(slugifySegment("King'ong'o")).toBe('kingongo');
  });
});
