import { chipsFor, filtersHref, parseFilters, toApiQuery, withoutChip } from '../explore-params';

const places = [{ slug: 'boma', name: 'Boma' }, { slug: 'nyaribo', name: 'Nyaribo' }];
const landmarks = [{ slug: 'dekut', name: 'DeKUT' }];

describe('parseFilters', () => {
  it('reads and sanitises the query string', () => {
    const f = parseFilters({ q: ' bedsitter ', mode: 'nightly', place: 'boma,nyaribo', max_price: '8000.7', kind: 'castle', sort: 'weird', has_video: 'true' });
    expect(f).toMatchObject({ q: 'bedsitter', mode: 'nightly', place: ['boma', 'nyaribo'], max_price: '8001', kind: '', sort: '', has_video: 'true' });
  });

  it('ignores junk numbers and unknown values', () => {
    expect(parseFilters({ min_price: 'abc', max_price: '-5', gender: 'x' })).toMatchObject({ min_price: '', max_price: '', gender: '' });
  });
});

describe('API query and URLs', () => {
  it('maps filters to the API and back to short, shareable links', () => {
    const f = parseFilters({ q: 'baraka', place: 'boma', max_price: '8000', unit_kind: 'bedsitter,studio' });
    expect(toApiQuery(f, { limit: 12 })).toMatchObject({ q: 'baraka', place: 'boma', max_price: 8000, unit_kind: 'bedsitter,studio', limit: 12, mode: 'monthly' });
    expect(filtersHref(f)).toBe('/?q=baraka&place=boma&unit_kind=bedsitter%2Cstudio&max_price=8000');
    expect(filtersHref({})).toBe('/');
    expect(filtersHref({ mode: 'nightly', sort: 'best' })).toBe('/?mode=nightly');
  });
});

describe('chips', () => {
  it('names every applied filter in plain words', () => {
    const f = parseFilters({ place: 'boma', near: 'dekut', max_price: '8000', unit_kind: 'bedsitter', amenities: 'wifi' });
    expect(chipsFor(f, places, landmarks).map((c) => c.label)).toEqual(['Boma', 'Near DeKUT', 'Bedsitter', 'Under KSh 8,000', 'Wi-Fi']);
  });

  it('removing one chip leaves the others', () => {
    const f = parseFilters({ place: 'boma,nyaribo', max_price: '8000', mode: 'nightly' });
    const chips = chipsFor(f, places, landmarks);
    expect(withoutChip(f, chips.find((c) => c.value === 'boma')!).place).toEqual(['nyaribo']);
    expect(withoutChip(f, chips.find((c) => c.key === 'max_price')!).max_price).toBe('');
    expect(withoutChip(f, chips.find((c) => c.key === 'mode')!).mode).toBe('monthly');
  });
});
