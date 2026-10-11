import { categoryLabel, listingHref, placeLabel, pricePeriodLabel } from '../video-listing';
import { formatAreaName, normaliseArea } from '../area-label';
import type { Listing } from '@/types';

const base = { id: 'abc', title: 'T', description: '', price: 1, location: 'Nyeri Town', agent_id: '1', is_active: true } as Listing;

describe('video listing helpers', () => {
  it('links short stays to /bnb and slugged listings to their canonical path', () => {
    expect(listingHref({ ...base, property_type: 'short_stay' })).toBe('/bnb/abc');
    expect(listingHref({ ...base, slug: 'sunrise', area: 'Near Gate A', county: 'Nyeri' })).toBe('/hostels/nyeri/near-gate-a/sunrise');
    expect(listingHref(base)).toBe('/listing/abc');
  });

  it('labels category, price period and place from the real record', () => {
    expect(categoryLabel({ ...base, property_type: 'apartment' })).toBe('Apartment');
    expect(categoryLabel(base)).toBe('Hostel');
    expect(pricePeriodLabel({ ...base, property_type: 'short_stay' })).toBe('night');
    expect(pricePeriodLabel(base)).toBe('month');
    expect(placeLabel({ ...base, area: 'embassy-area' })).toBe('Embassy Area');
    expect(placeLabel(base)).toBe('Nyeri Town');
  });
});

describe('area names', () => {
  it('treats slugs and names as the same area', () => {
    expect(normaliseArea('Embassy Area')).toBe(normaliseArea('embassy-area'));
  });
  it('title-cases slugs but leaves proper names alone', () => {
    expect(formatAreaName('near-gate-a')).toBe('Near Gate A');
    expect(formatAreaName('Kahawa Ridge')).toBe('Kahawa Ridge');
    expect(formatAreaName(null)).toBe('');
  });
});
