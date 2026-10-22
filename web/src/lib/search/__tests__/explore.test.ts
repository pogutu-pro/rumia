import {
  amenityOptions,
  cardHighlights,
  cardKind,
  distanceRank,
  matchesRefinements,
  roomTypeOptions,
  sortListings,
} from '../explore';
import type { SearchListing } from '../types';

const base: SearchListing = {
  id: 'x', title: 'X', description: '', price: 5000, location: '', slug: null, county: 'nyeri', area: 'Boma',
  listing_images: [], agents: null,
};
const L = (id: string, o: Partial<SearchListing> = {}): SearchListing => ({ ...base, id, title: id, ...o });

const hostelNear = L('hostel-near', { property_type: 'hostel', distance_category: '5-10min', bathroom_type: 'Private', price: 7000, created_at: '2026-09-01', room_type: 'Bedsitter - 1 person', wifi_included: true, water_included: true });
const apartmentFar = L('apt-far', { property_type: 'apartment', distance_category: 'over-3km', bathroom_type: 'Private', price: 9000, created_at: '2026-10-01' });
const hostelMid = L('hostel-mid', { property_type: 'hostel', distance_category: '1-2km', bathroom_type: 'Shared', price: 4000, created_at: '2026-08-01', room_type: 'Single' });
const unknownDistance = L('unknown', { property_type: null, distance_category: null, price: 4000, created_at: '2026-07-01' });
const all = [hostelNear, apartmentFar, hostelMid, unknownDistance];
const none = { propertyType: null, bathroom: null, distance: null } as const;

describe('matchesRefinements', () => {
  it('apartments are a kind of place on Explore; a missing kind counts as hostel', () => {
    expect(all.filter((l) => matchesRefinements(l, { ...none, propertyType: 'apartment' })).map((l) => l.id)).toEqual(['apt-far']);
    expect(all.filter((l) => matchesRefinements(l, { ...none, propertyType: 'hostel' })).map((l) => l.id)).toEqual(['hostel-near', 'hostel-mid', 'unknown']);
  });

  it('walking distance means up to 5-10 min; within 2 km adds 1-2 km; unknown distance never passes', () => {
    expect(all.filter((l) => matchesRefinements(l, { ...none, distance: 'walk' })).map((l) => l.id)).toEqual(['hostel-near']);
    expect(all.filter((l) => matchesRefinements(l, { ...none, distance: 'near' })).map((l) => l.id)).toEqual(['hostel-near', 'hostel-mid']);
  });

  it('bathroom matches regardless of case', () => {
    expect(all.filter((l) => matchesRefinements(l, { ...none, bathroom: 'shared' })).map((l) => l.id)).toEqual(['hostel-mid']);
  });
});

describe('sortListings', () => {
  it('recommended keeps the incoming order', () => {
    expect(sortListings(all, 'recommended')).toBe(all);
  });

  it('price sorts, with ties kept in recommended order', () => {
    expect(sortListings(all, 'price_asc').map((l) => l.id)).toEqual(['hostel-mid', 'unknown', 'hostel-near', 'apt-far']);
    expect(sortListings(all, 'price_desc').map((l) => l.id)).toEqual(['apt-far', 'hostel-near', 'hostel-mid', 'unknown']);
  });

  it('nearest puts unknown distances last; newest is by creation date', () => {
    expect(sortListings(all, 'nearest').map((l) => l.id)).toEqual(['hostel-near', 'hostel-mid', 'apt-far', 'unknown']);
    expect(sortListings(all, 'newest').map((l) => l.id)).toEqual(['apt-far', 'hostel-near', 'hostel-mid', 'unknown']);
  });

  it('never mutates its input', () => {
    const copy = [...all];
    sortListings(all, 'price_asc');
    expect(all).toEqual(copy);
  });
});

describe('options and card text', () => {
  it('offers only room types that some listing has, with counts', () => {
    const opts = roomTypeOptions(all);
    expect(opts.find((o) => o.value === 'bedsitter')).toMatchObject({ label: 'Bedsitter', count: 1 });
    expect(opts.find((o) => o.value === 'single')).toMatchObject({ label: 'Single room', count: 1 });
    expect(opts.some((o) => o.value === 'two_bedroom')).toBe(false);
  });

  it('lists amenities by frequency and leaves bills to their own section', () => {
    const opts = amenityOptions([L('a', { amenities: ['Kitchen', 'WiFi'] }), L('b', { amenities: ['Kitchen', 'CCTV'] })]);
    expect(opts.map((o) => [o.value, o.count])).toEqual([['Kitchen', 2], ['CCTV', 1]]);
  });

  it('card kind and highlights only state what the listing says', () => {
    expect(cardKind(hostelNear)).toBe('Bedsitter');
    expect(cardKind(apartmentFar)).toBe('Apartment');
    expect(cardKind(unknownDistance)).toBe('Hostel');
    expect(cardHighlights(hostelNear)).toEqual(['WiFi included', 'Water included', 'Private bathroom']);
    expect(cardHighlights(unknownDistance)).toEqual([]);
  });

  it('ranks distances nearest first', () => {
    expect(distanceRank('walking-500m')).toBeLessThan(distanceRank('5-10min'));
    expect(distanceRank('over-3km')).toBeLessThan(distanceRank(null));
  });
});
