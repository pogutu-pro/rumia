import { centerOf, haversineKm, nearestLandmark } from '../geo';

const NYERI = { lat: -0.4169, lng: 36.9511 };

describe('haversineKm', () => {
  it('is zero for the same point', () => {
    expect(haversineKm(NYERI, NYERI)).toBe(0);
  });

  it('measures a known distance approximately', () => {
    // Nyeri CBD to DeKUT is roughly 6 km.
    const dekut = { lat: -0.3971, lng: 36.9609 };
    expect(haversineKm(NYERI, dekut)).toBeGreaterThan(1);
    expect(haversineKm(NYERI, dekut)).toBeLessThan(9);
  });
});

describe('nearestLandmark', () => {
  const landmarks = [
    { slug: 'dekut', name: 'DeKUT', lat: -0.3971, lng: 36.9609 },
    { slug: 'cbd', name: 'Nyeri CBD', lat: -0.4169, lng: 36.9511 },
    { slug: 'nope', name: 'No coords' },
  ];

  it('picks the closest landmark with coordinates', () => {
    expect(nearestLandmark(NYERI, landmarks)?.slug).toBe('cbd');
  });

  it('returns null when everything is out of range', () => {
    expect(nearestLandmark({ lat: 1, lng: 1 }, landmarks)).toBeNull();
  });

  it('ignores landmarks without coordinates', () => {
    const only = [{ slug: 'nope' }, landmarks[0]];
    expect(nearestLandmark(NYERI, only)?.slug).toBe('dekut');
  });
});

describe('centerOf', () => {
  it('averages usable coordinates', () => {
    expect(centerOf([{ lat: 1, lng: 2 }, { lat: 3, lng: 4 }, { lat: null, lng: null }])).toEqual({ lat: 2, lng: 3 });
  });

  it('returns null with no coordinates', () => {
    expect(centerOf([{}, { lat: 1 }])).toBeNull();
  });
});
