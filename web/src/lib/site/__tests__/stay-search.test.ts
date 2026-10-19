import { estimateTotal, matchesSearch, nightsBetween, parseSearch, searchQuery, shortRange } from '../stay-search';
import type { BnbStay } from '../bnb-api';

const stay = (bnb: Record<string, unknown> = {}, extra: Record<string, unknown> = {}) =>
  ({ id: '1', title: 'Regal Residence', price: 4000, location: 'Nyeri', area: 'Nyeri view', county: 'nyeri', youtube_id: null, bnb, ...extra }) as unknown as BnbStay;

describe('search in the URL', () => {
  it('round-trips and drops nonsense', () => {
    const s = parseSearch(new URLSearchParams('where=Nyeri&in=2026-12-01&out=2026-12-04&guests=3&type=entire'));
    expect(s).toEqual({ where: 'Nyeri', checkIn: '2026-12-01', checkOut: '2026-12-04', guests: 3, type: 'entire' });
    expect(searchQuery(s)).toBe('?where=Nyeri&in=2026-12-01&out=2026-12-04&guests=3&type=entire');
    expect(parseSearch({ in: '2026-12-04', out: '2026-12-01', guests: '999', type: 'x' })).toMatchObject({ checkOut: null, guests: 50, type: 'all' });
    expect(searchQuery({})).toBe('');
  });
});

describe('estimateTotal matches the API rules', () => {
  it('nightly plus cleaning', () => {
    expect(estimateTotal(stay({ cleaning_fee: 500 }), 3)).toEqual({ room: 12000, cleaning: 500, total: 12500, basis: 'night' });
  });
  it('weekly from 7 nights, monthly from 30, never above nightly', () => {
    expect(estimateTotal(stay({ weekly_price: 21000 }), 14)?.room).toBe(42000);
    expect(estimateTotal(stay({ weekly_price: 21000, monthly_price: 60000 }), 61)).toMatchObject({ basis: 'month', room: 122000 });
    expect(estimateTotal(stay({ weekly_price: 30000 }), 7)).toMatchObject({ basis: 'night', room: 28000 });
  });
  it('nothing without nights', () => {
    expect(estimateTotal(stay(), 0)).toBeNull();
    expect(nightsBetween('2026-12-01', '2026-12-04')).toBe(3);
  });
});

describe('matchesSearch', () => {
  it('filters by place, guests, length and kind', () => {
    const s = parseSearch({});
    expect(matchesSearch(stay({ max_guests: 2 }), { ...s, guests: 3 })).toBe(false);
    expect(matchesSearch(stay(), { ...s, where: 'kamakwa' })).toBe(false);
    expect(matchesSearch(stay(), { ...s, where: 'nyeri view' })).toBe(true);
    expect(matchesSearch(stay({ min_stay_nights: 3 }), { ...s, checkIn: '2026-12-01', checkOut: '2026-12-02' })).toBe(false);
    expect(matchesSearch(stay({ listing_type: 'private_room' }), { ...s, type: 'entire' })).toBe(false);
    expect(matchesSearch(stay({}, { youtube_id: 'abc' }), { ...s, type: 'video' })).toBe(true);
    expect(matchesSearch(stay({ monthly_price: 60000 }), { ...s, type: 'long' })).toBe(true);
  });
  it('formats short ranges', () => {
    expect(shortRange('2026-12-12', '2026-12-15')).toBe('12–15 Dec');
    expect(shortRange('2026-12-28', '2027-01-02')).toBe('28 Dec – 2 Jan');
  });
});
