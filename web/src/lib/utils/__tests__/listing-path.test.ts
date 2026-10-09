import { listingPath, slugifySegment } from '../listing-path';

describe('listingPath', () => {
  it('lowercases and hyphenates segments', () => {
    expect(listingPath({ county: 'nyeri', area: 'Near Gate A', slug: 'blessed-court-1a2b' })).toBe(
      '/hostels/nyeri/near-gate-a/blessed-court-1a2b',
    );
  });

  it('keeps the already-clean case unchanged', () => {
    expect(listingPath({ county: 'nyeri', area: 'boma', slug: 'baraka-boma' })).toBe('/hostels/nyeri/boma/baraka-boma');
  });

  it('falls back to defaults for missing values', () => {
    expect(listingPath({ slug: 'x' })).toBe('/hostels/nyeri/dekut/x');
    expect(listingPath({ county: '???', area: '', slug: 'x' })).toBe('/hostels/nyeri/dekut/x');
  });

  it("handles apostrophes and punctuation (King'ong'o)", () => {
    expect(slugifySegment("King'ong'o")).toBe('king-ong-o');
  });
});
