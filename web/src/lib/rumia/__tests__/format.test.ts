import { exploreHref, includedLine, ksh, pricePerPeriod, unitLabel } from '../format';

describe('price formatting', () => {
  it('formats shillings and always attaches the period', () => {
    expect(ksh(7500)).toBe('KSh 7,500');
    expect(ksh(null)).toBe('');
    expect(pricePerPeriod(7500, 'month')).toBe('KSh 7,500 / month');
    expect(pricePerPeriod(3500, 'night')).toBe('KSh 3,500 / night');
  });
});

describe('labels', () => {
  it('uses plain names for room types, falling back to the lister label for "other"', () => {
    expect(unitLabel({ unit_kind: 'bedsitter', label: 'x' })).toBe('Bedsitter');
    expect(unitLabel({ unit_kind: 'other', label: 'Self-contained' })).toBe('Self-contained');
    expect(unitLabel({ unit_kind: 'other', label: null })).toBe('Room');
  });

  it('lists what is included, or nothing', () => {
    expect(includedLine(['water', 'wifi'])).toBe('Included: Water, Wi-Fi');
    expect(includedLine([])).toBe('');
  });
});

describe('exploreHref', () => {
  it('builds a shareable query string and drops empty filters', () => {
    expect(exploreHref({ q: 'bedsitter', max_price: 8000, place: ['boma', 'nyaribo'], kind: '' })).toBe(
      '/?q=bedsitter&max_price=8000&place=boma%2Cnyaribo',
    );
    expect(exploreHref({})).toBe('/');
  });
});
